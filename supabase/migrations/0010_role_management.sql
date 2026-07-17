-- ============================================================================
-- Phase 9b: Co-Captain-Rechte + Rollenverwaltung.
--   NACH 0009 ausführen (Enum-Wert 'co_captain' muss committed sein).
--   - Co-Captain darf Inhalte bearbeiten (Kader, Spieltage, Umfragen,
--     Aufstellungen, Verfügbarkeiten) wie ein Captain, aber NICHT einladen
--     und NICHT Rollen vergeben.
--   - Rollenvergabe via SECURITY-DEFINER-RPCs (Captain/Vereins-Admin/Plattform-
--     Admin); Membership-Schreibzugriff für Clients sonst gesperrt.
--   - „Letzter Captain" eines Teams kann nicht entfernt/herabgestuft werden.
-- ============================================================================

-- ── Helfer: Rolle inkl. co_captain; „Editor" = Captain ODER Co-Captain ────────
create or replace function app.current_team_role(p_team uuid) returns text
language sql stable security definer set search_path = public, app as $$
  select case
    when app.is_platform_admin() then 'team_admin'
    when exists (
      select 1 from public.memberships m join public.teams t on t.id = p_team
      where m.user_id = auth.uid() and m.role = 'club_admin' and m.club_id = t.club_id
    ) then 'team_admin'
    when exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.team_id = p_team and m.role = 'team_admin'
    ) then 'team_admin'
    when exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.team_id = p_team and m.role = 'co_captain'
    ) then 'co_captain'
    when exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid() and m.team_id = p_team and m.role = 'player'
    ) then 'player'
    else null
  end;
$$;

-- Inhaltsbearbeitung (Kader/Spieltage/Umfragen): Captain oder Co-Captain.
create or replace function app.is_team_editor(p_team uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.current_team_role(p_team) in ('team_admin', 'co_captain');
$$;

-- can_edit_player nutzt jetzt is_team_editor → Co-Captain darf fremde
-- Präferenzen/Verfügbarkeiten/Umfrageantworten pflegen (wie Captain).
create or replace function app.can_edit_player(p_player uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.players pl
    where pl.id = p_player and (app.is_team_editor(pl.team_id) or pl.user_id = auth.uid())
  );
$$;

revoke all on function app.is_team_editor(uuid) from public;
grant execute on function app.is_team_editor(uuid) to authenticated;

-- ── memberships: co_captain im CHECK zulassen (scope_matches_role) ────────────
alter table public.memberships drop constraint scope_matches_role;
alter table public.memberships add constraint scope_matches_role check (
  (role = 'club_admin'                          and club_id is not null and team_id is null) or
  (role in ('team_admin','co_captain','player') and team_id is not null and club_id is null)
);

-- ── Content-Policies: is_team_admin → is_team_editor (Co-Captain darf mit) ─────
-- players
drop policy players_insert on public.players;
create policy players_insert on public.players for insert to authenticated
  with check (app.is_team_editor(team_id));
drop policy players_update on public.players;
create policy players_update on public.players for update to authenticated
  using (app.is_team_editor(team_id) or user_id = auth.uid())
  with check (app.is_team_editor(team_id) or user_id = auth.uid());
drop policy players_delete on public.players;
create policy players_delete on public.players for delete to authenticated
  using (app.is_team_editor(team_id));

-- matchdays
drop policy md_insert on public.matchdays;
create policy md_insert on public.matchdays for insert to authenticated
  with check (app.is_team_editor(team_id));
drop policy md_update on public.matchdays;
create policy md_update on public.matchdays for update to authenticated
  using (app.is_team_editor(team_id)) with check (app.is_team_editor(team_id));
drop policy md_delete on public.matchdays;
create policy md_delete on public.matchdays for delete to authenticated
  using (app.is_team_editor(team_id));

-- polls
drop policy polls_insert on public.polls;
create policy polls_insert on public.polls for insert to authenticated
  with check (app.is_team_editor(team_id));
drop policy polls_update on public.polls;
create policy polls_update on public.polls for update to authenticated
  using (app.is_team_editor(team_id)) with check (app.is_team_editor(team_id));
drop policy polls_delete on public.polls;
create policy polls_delete on public.polls for delete to authenticated
  using (app.is_team_editor(team_id));

-- poll_options
drop policy po_write on public.poll_options;
create policy po_write on public.poll_options for all to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id and app.is_team_editor(p.team_id)))
  with check (exists (select 1 from public.polls p where p.id = poll_id and app.is_team_editor(p.team_id)));

-- Hinweis: pp_write / ptp_write / mp_write / pr_write nutzen can_edit_player und
-- sind damit automatisch abgedeckt. invites bleiben is_team_admin (nur Captain).

-- ── Membership-Schreibzugriff für Clients sperren → nur via RPC ───────────────
-- (redeem_invite / approve_club_request / set_member_role / remove_member sind
--  SECURITY DEFINER und umgehen RLS; Clients brauchen kein direktes insert/delete.)
drop policy if exists m_insert on public.memberships;
drop policy if exists m_delete on public.memberships;

-- ── Rollenvergabe-RPCs (SECURITY DEFINER) ─────────────────────────────────────
-- Setzt/ändert die Team-Rolle eines Nutzers. Erlaubt für Plattform-Admin,
-- Vereins-Admin (des Vereins) und Team-Admin (des Teams). Nur Team-Rollen.
create or replace function public.set_member_role(
  p_user uuid, p_team uuid, p_role public.role_type
) returns void
language plpgsql security definer set search_path = public, app as $$
declare v_club uuid;
begin
  if p_role not in ('team_admin', 'co_captain', 'player') then
    raise exception 'invalid role';
  end if;
  select club_id into v_club from public.teams where id = p_team;
  if v_club is null then raise exception 'team not found'; end if;
  if not (app.is_platform_admin() or app.is_club_admin(v_club) or app.is_team_admin(p_team)) then
    raise exception 'not authorized';
  end if;
  -- Letzter-Captain-Schutz
  if p_role <> 'team_admin'
     and exists (select 1 from public.memberships where user_id = p_user and team_id = p_team and role = 'team_admin')
     and (select count(*) from public.memberships where team_id = p_team and role = 'team_admin') <= 1 then
    raise exception 'cannot remove the last captain of the team';
  end if;
  -- Genau eine Team-Rolle je Nutzer: bestehende ersetzen.
  delete from public.memberships where user_id = p_user and team_id = p_team;
  insert into public.memberships (user_id, team_id, role) values (p_user, p_team, p_role);
end $$;

-- Entfernt einen Nutzer aus einem Team (Mitgliedschaft löschen).
create or replace function public.remove_member(p_user uuid, p_team uuid)
returns void
language plpgsql security definer set search_path = public, app as $$
declare v_club uuid;
begin
  select club_id into v_club from public.teams where id = p_team;
  if v_club is null then raise exception 'team not found'; end if;
  if not (app.is_platform_admin() or app.is_club_admin(v_club) or app.is_team_admin(p_team)) then
    raise exception 'not authorized';
  end if;
  if exists (select 1 from public.memberships where user_id = p_user and team_id = p_team and role = 'team_admin')
     and (select count(*) from public.memberships where team_id = p_team and role = 'team_admin') <= 1 then
    raise exception 'cannot remove the last captain of the team';
  end if;
  delete from public.memberships where user_id = p_user and team_id = p_team;
end $$;

revoke all on function public.set_member_role(uuid, uuid, public.role_type) from public;
revoke all on function public.remove_member(uuid, uuid) from public;
grant execute on function public.set_member_role(uuid, uuid, public.role_type) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
