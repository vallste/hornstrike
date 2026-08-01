-- ============================================================================
-- Phase 9d: „Letzter-Admin/Captain"-Schutz gegen Nebenläufigkeit härten.
--   NACH 0011 ausführen. Einmalig im Supabase-SQL-Editor.
--
-- Problem (aus adversarialer Review): set_club_admin / set_member_role /
--   remove_member prüfen den verbleibenden Admin-/Captain-Count OHNE Row-Lock.
--   Unter READ COMMITTED sehen zwei parallele Entfernungen ZWEIER
--   verschiedener Admins/Captains jeweils count = 2, beide bestehen die
--   `<= 1`-Prüfung, beide DELETEs committen → Verein/Team ohne Admin/Captain.
--
-- Fix: die Prüf-und-Schreib-Sequenz pro Verein/Team serialisieren – ein
--   transaktionsgebundener Advisory-Lock (deadlockfrei, ein Lock je Aufruf).
--   Namensraum-Konstante trennt Verein (1) und Team (2). Bodies sonst
--   unverändert ggü. 0010/0011. `create or replace` erhält bestehende GRANTs.
-- ============================================================================

-- ── Team-Rolle setzen (mit Letzter-Captain-Schutz) ────────────────────────────
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
  -- Serialisiert konkurrierende Rollenwechsel für DIESES Team.
  perform pg_advisory_xact_lock(2, hashtext(p_team::text));
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

-- ── Mitglied aus Team entfernen (mit Letzter-Captain-Schutz) ──────────────────
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
  perform pg_advisory_xact_lock(2, hashtext(p_team::text));
  if exists (select 1 from public.memberships where user_id = p_user and team_id = p_team and role = 'team_admin')
     and (select count(*) from public.memberships where team_id = p_team and role = 'team_admin') <= 1 then
    raise exception 'cannot remove the last captain of the team';
  end if;
  delete from public.memberships where user_id = p_user and team_id = p_team;
end $$;

-- ── Vereins-Admin setzen/entfernen (mit Letzter-Vereins-Admin-Schutz) ─────────
create or replace function public.set_club_admin(p_user uuid, p_club uuid, p_make boolean)
returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if p_club is null then raise exception 'club not found'; end if;
  if not exists (select 1 from public.clubs where id = p_club) then raise exception 'club not found'; end if;
  if not (app.is_platform_admin() or app.is_club_admin(p_club)) then
    raise exception 'not authorized';
  end if;

  if p_make then
    insert into public.memberships(user_id, club_id, role)
    values (p_user, p_club, 'club_admin')
    on conflict do nothing;
  else
    -- Serialisiert konkurrierende Entfernungen für DIESEN Verein.
    perform pg_advisory_xact_lock(1, hashtext(p_club::text));
    -- Letzter-Vereins-Admin-Schutz: der einzige verbleibende Admin bleibt bestehen.
    if exists (
         select 1 from public.memberships
         where user_id = p_user and club_id = p_club and role = 'club_admin'
       )
       and (select count(*) from public.memberships
            where club_id = p_club and role = 'club_admin') <= 1 then
      raise exception 'cannot remove the last admin of the club';
    end if;
    delete from public.memberships
     where user_id = p_user and club_id = p_club and role = 'club_admin';
  end if;
end $$;
