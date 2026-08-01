-- ============================================================================
-- Phase 9c: Vereins-Admin (club_admin) vergeben/entfernen.
--   NACH 0010 ausführen. Einmalig im Supabase-SQL-Editor.
--   - Bisher entstand club_admin NUR über die Vereins-Antrag-Freigabe → pro
--     Verein war nur EIN Vereins-Admin möglich (keine Übergabe, kein Zweiter).
--   - Jetzt: Plattform-Admin UND bestehende Vereins-Admins dürfen weitere
--     Vereins-Admins ernennen/entfernen (Mehrfach + Übergabe), mit
--     „Letzter-Vereins-Admin"-Schutz – analog zur Captain-Regel (0010).
--   - club_members(): SECURITY-DEFINER-Leseliste, damit ein Vereins-Admin die
--     Namen der Vereinsmitglieder sieht (profiles-RLS lässt sonst nur das eigene
--     Profil zu).
-- ============================================================================

-- ── Mitgliederliste eines Vereins (für die Rollen-UI) ─────────────────────────
-- Aggregiert je Nutzer: club_admin-Flag + Team-Rollen innerhalb des Vereins.
-- Nur Vereins-Admin/Plattform-Admin dürfen sie abrufen.
create or replace function public.club_members(p_club uuid)
returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare v jsonb;
begin
  if not app.is_club_admin(p_club) then raise exception 'not authorized'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id',       u.user_id,
           'display_name',  u.display_name,
           'email',         u.email,
           'is_club_admin', u.is_club_admin,
           'team_roles',    u.team_roles
         ) order by u.is_club_admin desc, u.display_name nulls last, u.email), '[]'::jsonb)
  into v
  from (
    select m.user_id,
           p.display_name,
           p.email,
           bool_or(m.role = 'club_admin' and m.club_id = p_club) as is_club_admin,
           coalesce(
             jsonb_agg(distinct jsonb_build_object('team_id', m.team_id, 'team_name', t.name, 'role', m.role))
               filter (where m.team_id is not null),
             '[]'::jsonb
           ) as team_roles
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    left join public.teams t on t.id = m.team_id
    where m.club_id = p_club
       or m.team_id in (select id from public.teams where club_id = p_club)
    group by m.user_id, p.display_name, p.email
  ) u;
  return v;
end $$;

-- ── Vereins-Admin setzen/entfernen ────────────────────────────────────────────
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

revoke all on function public.club_members(uuid)                  from public;
revoke all on function public.set_club_admin(uuid, uuid, boolean) from public;
grant execute on function public.club_members(uuid)                  to authenticated;
grant execute on function public.set_club_admin(uuid, uuid, boolean) to authenticated;
