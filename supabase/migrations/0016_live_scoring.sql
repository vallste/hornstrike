-- ============================================================================
-- Phase 13: Live-Erfassung von Ergebnissen.
--   NACH 0015 ausführen. Einmalig im Supabase-SQL-Editor.
--
--   Regelwerk (Spielordnung TFVHH 2.6.3): „In jedem Satz werden maximal zehn
--   Tore ausgespielt, d.h. bei spätestens 6:4/4:6 bzw. 5:5 ist der Satz
--   beendet." Einzel = 1 Satz, Doppel = 2 Sätze → jede Begegnung hat exakt
--   16 Sätze, in beiden Spielfolgen (8 Einzel + 4 Doppel×2, bzw. mit fünftem
--   Doppel 6 Einzel + 5 Doppel×2). Satzpunkte: Sieg 2, bei 5:5 je 1 → 32 pro
--   Begegnung. Das deckt sich mit den Zahlen der Verbandsseite (z. B. 24:8).
--
--   ZWEI EBENEN, bewusst unabhängig voneinander:
--     matchday_sets   – der Satzstand. Das ist die Wahrheit für alle Summen.
--     matchday_events – optionales Protokoll: einzelne Tore, Timeouts,
--                       Positionswechsel. Wer nur Endstände tippt, erzeugt
--                       hier nie eine Zeile.
--   Beim Live-Tippen schreibt ein RPC beides in einer Transaktion, damit der
--   Stand nicht vom Protokoll abweichen kann – auch wenn zwei Leute gleichzeitig
--   erfassen.
-- ============================================================================

-- ── Status des Spieltags ─────────────────────────────────────────────────────
alter table public.matchdays add column if not exists status text not null default 'planned';
alter table public.matchdays drop constraint if exists matchdays_status_valid;
alter table public.matchdays add  constraint matchdays_status_valid
  check (status in ('planned', 'live', 'done'));

-- ── Zugriffs-Helfer: Spieltag → Team ─────────────────────────────────────────
create or replace function app.is_matchday_member(p_matchday uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from public.matchdays md
                 where md.id = p_matchday and app.is_team_member(md.team_id));
$$;

create or replace function app.can_edit_matchday(p_matchday uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from public.matchdays md
                 where md.id = p_matchday and app.is_team_editor(md.team_id));
$$;

revoke all on function app.is_matchday_member(uuid) from public;
revoke all on function app.can_edit_matchday(uuid)  from public;
grant execute on function app.is_matchday_member(uuid) to authenticated;
grant execute on function app.can_edit_matchday(uuid)  to authenticated;

-- ── Gegnerische Spieler je Partie ────────────────────────────────────────────
-- Freier Text: der gegnerische Kader liegt nicht in dieser Datenbank. Die Namen
-- werden erst nach Freigabe beider Spielpläne sichtbar, sind also IMMER
-- nachtragbar und nie Voraussetzung für die Erfassung.
create table if not exists public.matchday_opponents (
  matchday_id uuid     not null references public.matchdays(id) on delete cascade,
  game_index  smallint not null check (game_index between 1 and 12),
  slot        smallint not null check (slot in (0, 1)),   -- Doppel: 0 Sturm, 1 Tor
  name        text     not null check (length(btrim(name)) between 1 and 80),
  primary key (matchday_id, game_index, slot)
);

-- ── Sätze ────────────────────────────────────────────────────────────────────
create table if not exists public.matchday_sets (
  matchday_id   uuid     not null references public.matchdays(id) on delete cascade,
  game_index    smallint not null check (game_index between 1 and 12),
  set_no        smallint not null check (set_no in (1, 2)),
  goals_for     smallint not null default 0 check (goals_for     between 0 and 6),
  goals_against smallint not null default 0 check (goals_against between 0 and 6),
  updated_at    timestamptz not null default now(),
  primary key (matchday_id, game_index, set_no),
  -- Deckelung aus 2.6.3: höchstens zehn Tore, damit sind 6:5 o. ä. ausgeschlossen.
  constraint set_goal_cap check (goals_for + goals_against <= 10)
);

-- ── Protokoll ────────────────────────────────────────────────────────────────
--  side  = wem das Tor gutgeschrieben wird ('us' | 'them')
--  player_id/role = wer es verursacht hat (eigener Spieler)
--  Ein Eigentor ist deshalb side='them' MIT eigenem player_id und role='own_goal'.
--  opponent_slot verweist auf matchday_opponents, wenn der Gegner benannt ist.
create table if not exists public.matchday_events (
  id            uuid primary key default gen_random_uuid(),
  matchday_id   uuid     not null references public.matchdays(id) on delete cascade,
  game_index    smallint not null check (game_index between 1 and 12),
  set_no        smallint not null check (set_no in (1, 2)),
  seq           integer  not null check (seq > 0),
  kind          text     not null check (kind in ('goal', 'timeout', 'switch')),
  side          text     not null check (side in ('us', 'them')),
  player_id     uuid     references public.players(id) on delete set null,
  role          text     check (role in ('attack', 'defense', 'own_goal')),
  opponent_slot smallint check (opponent_slot in (0, 1)),
  created_at    timestamptz not null default now(),
  unique (matchday_id, game_index, set_no, seq)
);

create index if not exists matchday_events_lookup on public.matchday_events (matchday_id, game_index, set_no, seq);
create index if not exists matchday_events_player on public.matchday_events (player_id) where player_id is not null;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.matchday_opponents enable row level security;
alter table public.matchday_sets      enable row level security;
alter table public.matchday_events    enable row level security;

grant select, insert, update, delete on public.matchday_opponents to authenticated;
grant select, insert, update, delete on public.matchday_sets      to authenticated;
grant select                        on public.matchday_events     to authenticated;
-- Events werden ausschließlich über die RPCs geschrieben: nur so bleiben
-- Protokoll und Satzstand garantiert konsistent.

drop policy if exists mo_select on public.matchday_opponents;
drop policy if exists mo_write  on public.matchday_opponents;
create policy mo_select on public.matchday_opponents for select to authenticated
  using (app.is_matchday_member(matchday_id));
create policy mo_write on public.matchday_opponents for all to authenticated
  using (app.can_edit_matchday(matchday_id)) with check (app.can_edit_matchday(matchday_id));

drop policy if exists ms_select on public.matchday_sets;
drop policy if exists ms_write  on public.matchday_sets;
create policy ms_select on public.matchday_sets for select to authenticated
  using (app.is_matchday_member(matchday_id));
create policy ms_write on public.matchday_sets for all to authenticated
  using (app.can_edit_matchday(matchday_id)) with check (app.can_edit_matchday(matchday_id));

drop policy if exists me_select on public.matchday_events;
create policy me_select on public.matchday_events for select to authenticated
  using (app.is_matchday_member(matchday_id));

-- ── Satz beendet? ────────────────────────────────────────────────────────────
create or replace function app.set_finished(p_for smallint, p_against smallint) returns boolean
language sql immutable set search_path = public, app as $$
  select p_for >= 6 or p_against >= 6 or (p_for + p_against) >= 10;
$$;
revoke all on function app.set_finished(smallint, smallint) from public;
grant execute on function app.set_finished(smallint, smallint) to authenticated;

-- ── Ereignis erfassen (Tor / Timeout / Positionswechsel) ─────────────────────
-- Schreibt Protokollzeile und – bei einem Tor – den Satzstand in EINER
-- Transaktion. Der Advisory-Lock serialisiert gleichzeitiges Tippen auf
-- demselben Spieltag (gleiches Muster wie der Rollen-Schutz in 0012).
create or replace function public.record_match_event(
  p_matchday      uuid,
  p_game          smallint,
  p_set           smallint,
  p_kind          text,
  p_side          text,
  p_player        uuid     default null,
  p_role          text     default null,
  p_opponent_slot smallint default null
) returns public.matchday_sets
language plpgsql security definer set search_path = public, app as $$
declare
  v_seq integer;
  v_row public.matchday_sets;
begin
  if not app.can_edit_matchday(p_matchday) then raise exception 'not authorized'; end if;

  perform pg_advisory_xact_lock(3, hashtext(p_matchday::text));

  insert into public.matchday_sets (matchday_id, game_index, set_no)
  values (p_matchday, p_game, p_set)
  on conflict (matchday_id, game_index, set_no) do nothing;

  select * into v_row from public.matchday_sets
   where matchday_id = p_matchday and game_index = p_game and set_no = p_set;

  if p_kind = 'goal' then
    if app.set_finished(v_row.goals_for, v_row.goals_against) then
      raise exception 'set already finished';
    end if;
    if p_side = 'us' then
      v_row.goals_for := v_row.goals_for + 1;
    else
      v_row.goals_against := v_row.goals_against + 1;
    end if;
    update public.matchday_sets
       set goals_for = v_row.goals_for, goals_against = v_row.goals_against, updated_at = now()
     where matchday_id = p_matchday and game_index = p_game and set_no = p_set;
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq from public.matchday_events
   where matchday_id = p_matchday and game_index = p_game and set_no = p_set;

  insert into public.matchday_events
    (matchday_id, game_index, set_no, seq, kind, side, player_id, role, opponent_slot)
  values
    (p_matchday, p_game, p_set, v_seq, p_kind, p_side, p_player, p_role, p_opponent_slot);

  return v_row;
end $$;
revoke all on function public.record_match_event(uuid, smallint, smallint, text, text, uuid, text, smallint) from public;
grant execute on function public.record_match_event(uuid, smallint, smallint, text, text, uuid, text, smallint) to authenticated;

-- ── Letztes Ereignis eines Satzes zurücknehmen ───────────────────────────────
-- Fehltipps sind bei Live-Erfassung der Normalfall, nicht die Ausnahme.
create or replace function public.undo_match_event(
  p_matchday uuid, p_game smallint, p_set smallint
) returns public.matchday_sets
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
  if not found then raise exception 'nothing to undo'; end if;

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
  return v_row;
end $$;
revoke all on function public.undo_match_event(uuid, smallint, smallint) from public;
grant execute on function public.undo_match_event(uuid, smallint, smallint) to authenticated;
