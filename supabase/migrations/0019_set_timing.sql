-- ============================================================================
-- Phase 16: Zeiten je Satz – Anpfiff, Ende, und wann ein Tor wirklich fiel.
--   NACH 0018 ausführen. Einmalig im Supabase-SQL-Editor.
--
--   WAS BISHER FEHLTE: matchday_events.created_at hält fest, wann der Server
--   die Zeile geschrieben hat. Das war schon vorher ungenau und ist seit der
--   Warteschlange (0017) unbrauchbar: liegt ein Tor zehn Minuten im Funkloch,
--   trägt es die Ankunftszeit, nicht den Moment des Tores. Und einen Anpfiff
--   gab es überhaupt nicht – die Dauer eines Satzes ließ sich also bestenfalls
--   vom ersten bis zum letzten Tor schätzen, ohne Anlauf und ohne Ausklang.
--
--   NEU:
--     matchday_events.occurred_at – vom CLIENT im Moment des Tippens gesetzt
--     matchday_sets.started_at    – der „Go"-Knopf zwischen zwei Sätzen
--     matchday_sets.ended_at      – gesetzt, sobald der Satz entschieden ist
--
--   started_at wird nie überschrieben: Wer zweimal auf „Go" tippt (oder zwei
--   Leute gleichzeitig), verschiebt den Anpfiff nicht. Fällt ein Tor, ohne dass
--   jemand „Go" gedrückt hat, gilt dieses Tor als Anpfiff – lieber eine etwas
--   zu kurze Zeit als gar keine.
-- ============================================================================

alter table public.matchday_events add column if not exists occurred_at timestamptz;
alter table public.matchday_sets   add column if not exists started_at  timestamptz;
alter table public.matchday_sets   add column if not exists ended_at    timestamptz;

-- Altbestand: die Schreibzeit ist die beste verfügbare Näherung.
update public.matchday_events set occurred_at = created_at where occurred_at is null;

-- ── Anpfiff ─────────────────────────────────────────────────────────────────
-- Legt die Satzzeile bei Bedarf an und setzt started_at genau einmal.
create or replace function public.start_match_set(
  p_matchday uuid, p_game smallint, p_set smallint, p_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_row public.matchday_sets;
begin
  if not app.can_edit_matchday(p_matchday) then raise exception 'not authorized'; end if;

  perform pg_advisory_xact_lock(3, hashtext(p_matchday::text));

  insert into public.matchday_sets (matchday_id, game_index, set_no, started_at)
  values (p_matchday, p_game, p_set, coalesce(p_at, now()))
  on conflict (matchday_id, game_index, set_no) do update
    set started_at = coalesce(public.matchday_sets.started_at, excluded.started_at);

  select * into v_row from public.matchday_sets
   where matchday_id = p_matchday and game_index = p_game and set_no = p_set;

  return jsonb_build_object('applied', true, 'reason', null, 'started_at', v_row.started_at);
end $$;
revoke all on function public.start_match_set(uuid, smallint, smallint, timestamptz) from public;
grant execute on function public.start_match_set(uuid, smallint, smallint, timestamptz) to authenticated;

-- ── Ereignis erfassen: jetzt mit Zeitpunkt ──────────────────────────────────
-- Signatur ändert sich erneut; ein „create or replace" würde eine zweite,
-- mehrdeutige Überladung anlegen statt zu ersetzen.
drop function if exists public.record_match_event(uuid, smallint, smallint, text, text, uuid, integer, uuid, text, smallint);

create or replace function public.record_match_event(
  p_matchday      uuid,
  p_game          smallint,
  p_set           smallint,
  p_kind          text,
  p_side          text,
  p_event_id      uuid,
  p_seq           integer,
  p_player        uuid        default null,
  p_role          text        default null,
  p_opponent_slot smallint    default null,
  p_occurred_at   timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_row public.matchday_sets;
  v_at  timestamptz := coalesce(p_occurred_at, now());
  v_result jsonb;
begin
  if not app.can_edit_matchday(p_matchday) then raise exception 'not authorized'; end if;
  if p_seq is null or p_seq < 1 then raise exception 'invalid sequence'; end if;

  perform pg_advisory_xact_lock(3, hashtext(p_matchday::text));

  insert into public.matchday_sets (matchday_id, game_index, set_no)
  values (p_matchday, p_game, p_set)
  on conflict (matchday_id, game_index, set_no) do nothing;

  select * into v_row from public.matchday_sets
   where matchday_id = p_matchday and game_index = p_game and set_no = p_set;

  v_result := jsonb_build_object(
    'goals_for', v_row.goals_for, 'goals_against', v_row.goals_against, 'seq', p_seq);

  if exists (select 1 from public.matchday_events where id = p_event_id) then
    return v_result || jsonb_build_object('applied', false, 'reason', 'duplicate');
  end if;

  if exists (
    select 1 from public.matchday_events
     where matchday_id = p_matchday and game_index = p_game and set_no = p_set and seq = p_seq
  ) then
    return v_result || jsonb_build_object('applied', false, 'reason', 'seq_taken');
  end if;

  if p_kind = 'goal' and app.set_finished(v_row.goals_for, v_row.goals_against) then
    return v_result || jsonb_build_object('applied', false, 'reason', 'set_finished');
  end if;

  if p_kind = 'goal' then
    if p_side = 'us' then
      v_row.goals_for := v_row.goals_for + 1;
    else
      v_row.goals_against := v_row.goals_against + 1;
    end if;
    update public.matchday_sets
       set goals_for  = v_row.goals_for,
           goals_against = v_row.goals_against,
           -- Ohne „Go" gilt das erste Tor als Anpfiff.
           started_at = coalesce(started_at, v_at),
           -- Entschieden? Dann ist das der Abpfiff.
           ended_at   = case when app.set_finished(v_row.goals_for, v_row.goals_against)
                             then coalesce(ended_at, v_at) else ended_at end,
           updated_at = now()
     where matchday_id = p_matchday and game_index = p_game and set_no = p_set;
  end if;

  insert into public.matchday_events
    (id, matchday_id, game_index, set_no, seq, kind, side, player_id, role, opponent_slot, occurred_at)
  values
    (p_event_id, p_matchday, p_game, p_set, p_seq, p_kind, p_side, p_player, p_role, p_opponent_slot, v_at);

  return jsonb_build_object(
    'applied', true, 'reason', null, 'seq', p_seq,
    'goals_for', v_row.goals_for, 'goals_against', v_row.goals_against);
end $$;

revoke all on function public.record_match_event(uuid, smallint, smallint, text, text, uuid, integer, uuid, text, smallint, timestamptz) from public;
grant execute on function public.record_match_event(uuid, smallint, smallint, text, text, uuid, integer, uuid, text, smallint, timestamptz) to authenticated;

-- ── Zurücknehmen: Abpfiff gegebenenfalls widerrufen ─────────────────────────
create or replace function public.undo_match_event(
  p_matchday uuid, p_game smallint, p_set smallint, p_seq integer default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_event public.matchday_events;
  v_row   public.matchday_sets;
begin
  if not app.can_edit_matchday(p_matchday) then raise exception 'not authorized'; end if;

  perform pg_advisory_xact_lock(3, hashtext(p_matchday::text));

  select * into v_event from public.matchday_events
   where matchday_id = p_matchday and game_index = p_game and set_no = p_set
   order by seq desc limit 1;

  if not found then
    return jsonb_build_object('applied', false, 'reason', 'nothing_to_undo');
  end if;

  if p_seq is not null and v_event.seq <> p_seq then
    return jsonb_build_object('applied', false, 'reason', 'already_undone');
  end if;

  delete from public.matchday_events where id = v_event.id;

  if v_event.kind = 'goal' then
    update public.matchday_sets
       set goals_for     = greatest(0, goals_for     - (case when v_event.side = 'us'   then 1 else 0 end)),
           goals_against = greatest(0, goals_against - (case when v_event.side = 'them' then 1 else 0 end)),
           updated_at    = now()
     where matchday_id = p_matchday and game_index = p_game and set_no = p_set;

    -- War der Satz durch dieses Tor entschieden, ist er es jetzt nicht mehr.
    update public.matchday_sets
       set ended_at = null
     where matchday_id = p_matchday and game_index = p_game and set_no = p_set
       and not app.set_finished(goals_for, goals_against);
  end if;

  select * into v_row from public.matchday_sets
   where matchday_id = p_matchday and game_index = p_game and set_no = p_set;

  return jsonb_build_object(
    'applied', true, 'reason', null, 'seq', v_event.seq,
    'goals_for', coalesce(v_row.goals_for, 0), 'goals_against', coalesce(v_row.goals_against, 0));
end $$;

revoke all on function public.undo_match_event(uuid, smallint, smallint, integer) from public;
grant execute on function public.undo_match_event(uuid, smallint, smallint, integer) to authenticated;
