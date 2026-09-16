-- ============================================================================
-- Phase 14: Live-Erfassung übersteht Verbindungsabbrüche und mehrere Tippende.
--   NACH 0016 ausführen. Einmalig im Supabase-SQL-Editor.
--
--   ZWEI PROBLEME, die beim Tippen am Tisch entstehen:
--
--   1. Wiederholung. Bricht die Antwort unterwegs ab, weiß der Client nicht, ob
--      das Tor angekommen ist. Er schickt erneut – und der Zähler steht zwei
--      höher, obwohl nur ein Tor fiel. Dasselbe gilt für die Warteschlange, die
--      nach einem Neustart der App erneut sendet.
--
--   2. Zwei Tippende. Beide sehen 4:3, beide erfassen dasselbe Tor. Ohne
--      Absprache werden daraus zwei.
--
--   LÖSUNG: der Client bestimmt beides selbst – eine eigene ID für den Vorgang
--   und die POSITION des Tores im Satz (seq, bisher vom Server vergeben). Der
--   Server nimmt jede Position genau einmal an:
--
--     gleiche Vorgangs-ID   → derselbe Tipp kommt nochmal an → stillschweigend ok
--     Position schon belegt → jemand anderes war schneller    → abgelehnt
--
--   Statt einer Ausnahme kommt ein Ergebnisobjekt zurück. Nur so kann der
--   Client eine abgelehnte Eingabe („war schon erfasst", kein Grund zur
--   Wiederholung) von einem echten Fehler unterscheiden, den er nachfassen muss.
--
--   BEWUSSTE GRENZE: fallen zwei verschiedene Tore so schnell, dass beide
--   Tippenden noch denselben Stand sehen, geht das zweite verloren – aus Sicht
--   des Servers sieht das identisch aus wie ein doppelt erfasstes Tor. Der
--   Client meldet jede Ablehnung sichtbar, damit der Satzstand von Hand
--   richtiggestellt werden kann. Die Umkehrung (lieber doppelt zählen) wäre die
--   schlechtere Wahl: ein zu hoher Zähler fällt niemandem auf.
--
--   Grobe Eingaben (Satzendstand, Gegner:innen-Name, Status) bleiben bewusst
--   „letzte Schreibung gewinnt" – dort gibt es nichts zu zählen.
-- ============================================================================

-- Alte Signaturen weichen: Rückgabetyp und Parameterliste ändern sich beide.
drop function if exists public.record_match_event(uuid, smallint, smallint, text, text, uuid, text, smallint);
drop function if exists public.undo_match_event(uuid, smallint, smallint);

-- ── Ereignis erfassen ────────────────────────────────────────────────────────
create or replace function public.record_match_event(
  p_matchday      uuid,
  p_game          smallint,
  p_set           smallint,
  p_kind          text,
  p_side          text,
  p_event_id      uuid,
  p_seq           integer,
  p_player        uuid     default null,
  p_role          text     default null,
  p_opponent_slot smallint default null
) returns jsonb
language plpgsql security definer set search_path = public, app as $$
declare
  v_row public.matchday_sets;
  v_result jsonb;
begin
  if not app.can_edit_matchday(p_matchday) then raise exception 'not authorized'; end if;
  if p_seq is null or p_seq < 1 then raise exception 'invalid sequence'; end if;

  -- Serialisiert gleichzeitiges Tippen auf demselben Spieltag (Muster aus 0012).
  perform pg_advisory_xact_lock(3, hashtext(p_matchday::text));

  insert into public.matchday_sets (matchday_id, game_index, set_no)
  values (p_matchday, p_game, p_set)
  on conflict (matchday_id, game_index, set_no) do nothing;

  select * into v_row from public.matchday_sets
   where matchday_id = p_matchday and game_index = p_game and set_no = p_set;

  v_result := jsonb_build_object(
    'goals_for', v_row.goals_for, 'goals_against', v_row.goals_against, 'seq', p_seq);

  -- 1. Kennen wir diesen Vorgang schon? Dann ist es eine Wiederholung.
  if exists (select 1 from public.matchday_events where id = p_event_id) then
    return v_result || jsonb_build_object('applied', false, 'reason', 'duplicate');
  end if;

  -- 2. Ist die Position im Satz vergeben? Dann war jemand anderes schneller.
  if exists (
    select 1 from public.matchday_events
     where matchday_id = p_matchday and game_index = p_game and set_no = p_set and seq = p_seq
  ) then
    return v_result || jsonb_build_object('applied', false, 'reason', 'seq_taken');
  end if;

  -- 3. Satz bereits entschieden? Kein Fehler, nur nichts mehr einzutragen.
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
       set goals_for = v_row.goals_for, goals_against = v_row.goals_against, updated_at = now()
     where matchday_id = p_matchday and game_index = p_game and set_no = p_set;
  end if;

  insert into public.matchday_events
    (id, matchday_id, game_index, set_no, seq, kind, side, player_id, role, opponent_slot)
  values
    (p_event_id, p_matchday, p_game, p_set, p_seq, p_kind, p_side, p_player, p_role, p_opponent_slot);

  return jsonb_build_object(
    'applied', true, 'reason', null, 'seq', p_seq,
    'goals_for', v_row.goals_for, 'goals_against', v_row.goals_against);
end $$;

revoke all on function public.record_match_event(uuid, smallint, smallint, text, text, uuid, integer, uuid, text, smallint) from public;
grant execute on function public.record_match_event(uuid, smallint, smallint, text, text, uuid, integer, uuid, text, smallint) to authenticated;

-- ── Letztes Ereignis zurücknehmen ────────────────────────────────────────────
-- Auch das muss wiederholbar sein: der Client nennt die Position, die er
-- entfernen will. Ist sie schon weg, war die Rücknahme bereits erfolgreich –
-- ein zweiter Versuch darf dann nicht das davor liegende Tor mitnehmen.
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

  -- Position genannt, aber das oberste Ereignis ist ein anderes: entweder
  -- schon zurückgenommen oder inzwischen ist etwas Neues dazugekommen.
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
  end if;

  select * into v_row from public.matchday_sets
   where matchday_id = p_matchday and game_index = p_game and set_no = p_set;

  return jsonb_build_object(
    'applied', true, 'reason', null, 'seq', v_event.seq,
    'goals_for', coalesce(v_row.goals_for, 0), 'goals_against', coalesce(v_row.goals_against, 0));
end $$;

revoke all on function public.undo_match_event(uuid, smallint, smallint, integer) from public;
grant execute on function public.undo_match_event(uuid, smallint, smallint, integer) to authenticated;
