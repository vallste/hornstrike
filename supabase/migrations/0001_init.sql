-- ============================================================================
-- Hornstrike – Multi-Verein-Fundament (Phasen 1 + 2)
-- Extensions, Enums, Tabellen, RLS-Helfer/Policies, GRANTs, Invite-/Club-RPCs.
-- Terminfindung (polls/…) folgt in einer späteren Migration (Phase 3).
--
-- Wichtig: Data-API "Automatically expose new tables" = AUS.
--   → Tabellen-Rechte werden hier EXPLIZIT nur an `authenticated` vergeben,
--     nie an `anon`. Sicherheit ruht zusätzlich auf RLS (default-deny).
-- Einmalig ausführen (nicht idempotent: create type/table).
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pgcrypto with schema extensions;

-- ── Helfer-Schema (SECURITY DEFINER Funktionen für RLS) ─────────────────────
create schema if not exists app;
grant usage on schema app to authenticated;
grant usage on schema public to authenticated;

-- ── Enums ───────────────────────────────────────────────────────────────────
create type public.position_pref  as enum ('attack','defense','attack_preferred','defense_preferred','both');
create type public.game_type_pref as enum ('singles_only','doubles_only','singles_preferred','doubles_preferred','both');
create type public.role_type      as enum ('club_admin','team_admin','player');
create type public.request_status as enum ('pending','approved','rejected');

-- ── Gemeinsamer updated_at-Trigger ──────────────────────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ============================================================================
-- TABELLEN
-- ============================================================================

-- profiles: 1:1 mit auth.users
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  email             text,
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Auto-Provisionierung des Profils bei Signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row
  execute function public.handle_new_user();

-- clubs / teams
create table public.clubs (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete restrict,
  name       text not null,
  league     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index teams_club_idx on public.teams(club_id);

-- memberships: relationale Rollen (Captain in Team A, Spieler in Team B = 2 Zeilen)
create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  club_id    uuid references public.clubs(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete cascade,
  role       public.role_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scope_matches_role check (
    (role = 'club_admin'             and club_id is not null and team_id is null) or
    (role in ('team_admin','player') and team_id is not null and club_id is null)
  )
);
create unique index memberships_team_uq on public.memberships(user_id, team_id, role) where team_id is not null;
create unique index memberships_club_uq on public.memberships(user_id, club_id, role) where club_id is not null;
create index memberships_team_idx on public.memberships(team_id);
create index memberships_club_idx on public.memberships(club_id);

-- players: Roster-Entität. id OHNE default → Client-UUIDs bleiben erhalten (Import).
create table public.players (
  id         uuid primary key,
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  name       text not null,
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index players_team_user_uq on public.players(team_id, user_id) where user_id is not null;
create index players_team_idx on public.players(team_id);

create table public.player_preferences (
  player_id         uuid primary key references public.players(id) on delete cascade,
  position          public.position_pref  not null default 'both',
  game_type         public.game_type_pref not null default 'both',
  goalie_preference boolean not null default false,
  avoids_opening    boolean not null default false,
  avoids_closing    boolean not null default false,
  updated_at        timestamptz not null default now()
);

create table public.partner_preferences (
  player_id         uuid not null references public.players(id) on delete cascade,
  partner_player_id uuid not null references public.players(id) on delete cascade,
  weight            smallint not null check (weight in (1,2,3)),
  primary key (player_id, partner_player_id),
  constraint no_self_partner check (player_id <> partner_player_id)
);

-- matchdays: lineup als JSONB-Snapshot. id OHNE default → Client-UUIDs erhalten.
create table public.matchdays (
  id               uuid primary key,
  team_id          uuid not null references public.teams(id) on delete cascade,
  date             date not null,
  opponent         text,
  use_goalie       boolean not null default false,
  use_fifth_double boolean not null default false,
  notes            text,
  lineup           jsonb not null default '[]'::jsonb,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index matchdays_team_date_idx on public.matchdays(team_id, date desc);

create table public.matchday_players (
  id             uuid primary key default gen_random_uuid(),
  matchday_id    uuid not null references public.matchdays(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  available_from int not null check (available_from between 1 and 12),
  available_to   int not null check (available_to   between 1 and 12),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint avail_range check (available_from <= available_to),
  unique (matchday_id, player_id)
);
create index matchday_players_md_idx on public.matchday_players(matchday_id);

-- invites: Zufallstoken, nur sha256 gespeichert
create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid references public.teams(id) on delete cascade,
  club_id     uuid references public.clubs(id) on delete cascade,
  player_id   uuid references public.players(id) on delete cascade,
  role        public.role_type not null,
  email       text,
  token_hash  bytea not null,
  created_by  uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at  timestamptz not null,
  accepted_at timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint invite_scope check (
    (role = 'club_admin'             and club_id is not null) or
    (role in ('team_admin','player') and team_id is not null)
  )
);
create unique index invites_token_uq on public.invites(token_hash);

-- club_requests: Antrag auf neuen Verein → Plattform-Admin gibt frei
create table public.club_requests (
  id           uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  club_name    text not null,
  note         text,
  status       public.request_status not null default 'pending',
  reviewed_by  uuid references auth.users(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index club_requests_status_idx on public.club_requests(status);

-- updated_at-Trigger auf alle Tabellen mit der Spalte
create trigger t_profiles_upd            before update on public.profiles            for each row execute function public.set_updated_at();
create trigger t_clubs_upd               before update on public.clubs               for each row execute function public.set_updated_at();
create trigger t_teams_upd               before update on public.teams               for each row execute function public.set_updated_at();
create trigger t_memberships_upd         before update on public.memberships         for each row execute function public.set_updated_at();
create trigger t_players_upd             before update on public.players             for each row execute function public.set_updated_at();
create trigger t_player_preferences_upd  before update on public.player_preferences  for each row execute function public.set_updated_at();
create trigger t_matchdays_upd           before update on public.matchdays           for each row execute function public.set_updated_at();
create trigger t_matchday_players_upd    before update on public.matchday_players    for each row execute function public.set_updated_at();
create trigger t_invites_upd             before update on public.invites             for each row execute function public.set_updated_at();
create trigger t_club_requests_upd       before update on public.club_requests       for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS-HELFER (SECURITY DEFINER → umgehen RLS, verhindern Rekursion)
-- ============================================================================

create or replace function app.is_platform_admin() returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_platform_admin);
$$;

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
      where m.user_id = auth.uid() and m.team_id = p_team and m.role = 'player'
    ) then 'player'
    else null
  end;
$$;

create or replace function app.is_team_admin(p_team uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.current_team_role(p_team) = 'team_admin';
$$;

create or replace function app.is_team_member(p_team uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.current_team_role(p_team) is not null;
$$;

create or replace function app.is_club_admin(p_club uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select app.is_platform_admin()
      or exists (
        select 1 from public.memberships
        where user_id = auth.uid() and club_id = p_club and role = 'club_admin'
      );
$$;

create or replace function app.can_edit_player(p_player uuid) returns boolean
language sql stable security definer set search_path = public, app as $$
  select exists (
    select 1 from public.players pl
    where pl.id = p_player and (app.is_team_admin(pl.team_id) or pl.user_id = auth.uid())
  );
$$;

-- Helfer werden in Policies aufgerufen → authenticated braucht EXECUTE.
revoke all on function
  app.is_platform_admin(), app.current_team_role(uuid), app.is_team_admin(uuid),
  app.is_team_member(uuid), app.is_club_admin(uuid), app.can_edit_player(uuid)
  from public;
grant execute on function
  app.is_platform_admin(), app.current_team_role(uuid), app.is_team_admin(uuid),
  app.is_team_member(uuid), app.is_club_admin(uuid), app.can_edit_player(uuid)
  to authenticated;

-- ============================================================================
-- RLS + POLICIES + GRANTS  (auto-expose AUS → GRANTs explizit an authenticated)
-- ============================================================================

-- ── profiles ────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid() or app.is_platform_admin());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Schutz: niemand darf sich selbst zum Plattform-Admin machen. Nur ein bestehender
-- Admin (oder der service_role-Kontext im SQL-Editor, wo auth.uid() null ist) darf
-- das Flag ändern. Erste Vergabe passiert manuell per SQL (siehe README).
create or replace function public.profiles_guard_admin_flag() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if new.is_platform_admin is distinct from old.is_platform_admin then
    if auth.uid() is not null and not app.is_platform_admin() then
      raise exception 'profiles: is_platform_admin darf nicht selbst gesetzt werden';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard_admin_flag before update on public.profiles
  for each row execute function public.profiles_guard_admin_flag();

-- ── clubs ──────────────────────────────────────────────────────────────────────────
alter table public.clubs enable row level security;
grant select, insert, update, delete on public.clubs to authenticated;
create policy clubs_select on public.clubs for select to authenticated
  using (app.is_club_admin(id) or exists (
    select 1 from public.teams t where t.club_id = clubs.id and app.is_team_member(t.id)
  ));
create policy clubs_update on public.clubs for update to authenticated using (app.is_club_admin(id)) with check (app.is_club_admin(id));
-- INSERT/DELETE clubs nur über RPC/Plattform-Admin → keine offene Policy.
create policy clubs_admin_all on public.clubs for all to authenticated using (app.is_platform_admin()) with check (app.is_platform_admin());

-- ── teams ─────────────────────────────────────────────────────────────────────
alter table public.teams enable row level security;
grant select, insert, update, delete on public.teams to authenticated;
create policy teams_select on public.teams for select to authenticated using (app.is_team_member(id) or app.is_club_admin(club_id));
create policy teams_insert on public.teams for insert to authenticated with check (app.is_club_admin(club_id));
create policy teams_update on public.teams for update to authenticated using (app.is_club_admin(club_id)) with check (app.is_club_admin(club_id));
create policy teams_delete on public.teams for delete to authenticated using (app.is_club_admin(club_id));

-- ── memberships ─────────────────────────────────────────────────────────────
alter table public.memberships enable row level security;
grant select, insert, update, delete on public.memberships to authenticated;
create policy m_select on public.memberships for select to authenticated using (
  user_id = auth.uid()
  or (team_id is not null and app.is_team_admin(team_id))
  or (club_id is not null and app.is_club_admin(club_id))
);
create policy m_insert on public.memberships for insert to authenticated with check (
  (role in ('team_admin','player') and team_id is not null and app.is_team_admin(team_id))
  or (role = 'club_admin' and club_id is not null and app.is_club_admin(club_id))
);
create policy m_delete on public.memberships for delete to authenticated using (
  (team_id is not null and app.is_team_admin(team_id))
  or (club_id is not null and app.is_club_admin(club_id))
);

-- ── players ───────────────────────────────────────────────────────────────────
alter table public.players enable row level security;
grant select, insert, update, delete on public.players to authenticated;
create policy players_select on public.players for select to authenticated using (app.is_team_member(team_id));
create policy players_insert on public.players for insert to authenticated with check (app.is_team_admin(team_id));
create policy players_update on public.players for update to authenticated
  using (app.is_team_admin(team_id) or user_id = auth.uid())
  with check (app.is_team_admin(team_id) or user_id = auth.uid());
create policy players_delete on public.players for delete to authenticated using (app.is_team_admin(team_id));

-- Schutz: Nicht-Admin darf team_id/user_id der eigenen Zeile nicht verbiegen.
create or replace function public.players_guard_self_update() returns trigger
language plpgsql security definer set search_path = public, app as $$
begin
  if not app.is_team_admin(old.team_id) then
    if new.team_id <> old.team_id or new.user_id is distinct from old.user_id then
      raise exception 'players: nur Team-Admins dürfen team_id/user_id ändern';
    end if;
  end if;
  return new;
end $$;
create trigger players_guard_self_update before update on public.players
  for each row execute function public.players_guard_self_update();

-- ── player_preferences ──────────────────────────────────────────────────────
alter table public.player_preferences enable row level security;
grant select, insert, update, delete on public.player_preferences to authenticated;
create policy pp_select on public.player_preferences for select to authenticated
  using (exists (select 1 from public.players pl where pl.id = player_id and app.is_team_member(pl.team_id)));
create policy pp_write on public.player_preferences for all to authenticated
  using (app.can_edit_player(player_id)) with check (app.can_edit_player(player_id));

-- ── partner_preferences ─────────────────────────────────────────────────────
alter table public.partner_preferences enable row level security;
grant select, insert, update, delete on public.partner_preferences to authenticated;
create policy ptp_select on public.partner_preferences for select to authenticated
  using (exists (select 1 from public.players pl where pl.id = player_id and app.is_team_member(pl.team_id)));
create policy ptp_write on public.partner_preferences for all to authenticated
  using (app.can_edit_player(player_id)) with check (app.can_edit_player(player_id));

-- ── matchdays ───────────────────────────────────────────────────────────────
alter table public.matchdays enable row level security;
grant select, insert, update, delete on public.matchdays to authenticated;
create policy md_select on public.matchdays for select to authenticated using (app.is_team_member(team_id));
create policy md_insert on public.matchdays for insert to authenticated with check (app.is_team_admin(team_id));
create policy md_update on public.matchdays for update to authenticated using (app.is_team_admin(team_id)) with check (app.is_team_admin(team_id));
create policy md_delete on public.matchdays for delete to authenticated using (app.is_team_admin(team_id));

-- ── matchday_players (Spieler darf eigene Verfügbarkeit, Captain für alle) ────
alter table public.matchday_players enable row level security;
grant select, insert, update, delete on public.matchday_players to authenticated;
create policy mp_select on public.matchday_players for select to authenticated
  using (exists (select 1 from public.matchdays md where md.id = matchday_id and app.is_team_member(md.team_id)));
create policy mp_write on public.matchday_players for all to authenticated
  using (app.can_edit_player(player_id))
  with check (
    app.can_edit_player(player_id)
    and exists (  -- Matchday und Spieler müssen zum selben Team gehören
      select 1 from public.matchdays md join public.players pl on pl.id = player_id
      where md.id = matchday_id and md.team_id = pl.team_id
    )
  );

-- ── invites (kein Lese-Pfad für Einlöser; Redemption nur via RPC) ─────────────
alter table public.invites enable row level security;
grant select, insert, update, delete on public.invites to authenticated;
create policy inv_select on public.invites for select to authenticated
  using ((team_id is not null and app.is_team_admin(team_id)) or (club_id is not null and app.is_club_admin(club_id)));
create policy inv_insert on public.invites for insert to authenticated
  with check ((team_id is not null and app.is_team_admin(team_id)) or (club_id is not null and app.is_club_admin(club_id)));
create policy inv_update on public.invites for update to authenticated
  using ((team_id is not null and app.is_team_admin(team_id)) or (club_id is not null and app.is_club_admin(club_id)));

-- ── club_requests (Antragsteller erstellt/liest eigene; Admin liest alle) ─────
alter table public.club_requests enable row level security;
grant select, insert, update, delete on public.club_requests to authenticated;
create policy cr_select on public.club_requests for select to authenticated
  using (requested_by = auth.uid() or app.is_platform_admin());
create policy cr_insert on public.club_requests for insert to authenticated
  with check (requested_by = auth.uid() and status = 'pending');
-- Freigabe/Ablehnung nur via approve/reject-RPC (SECURITY DEFINER) → keine UPDATE-Policy.

-- ============================================================================
-- RPCs (SECURITY DEFINER, nur für authenticated)
-- ============================================================================

-- Invite erstellen (Team-Admin) → gibt Rohtoken EINMALIG zurück
create or replace function public.create_invite(
  p_player uuid, p_role public.role_type, p_email text default null, p_ttl interval default interval '30 days'
) returns text
language plpgsql security definer set search_path = public, app, extensions as $$
declare v_team uuid; v_raw text;
begin
  select team_id into v_team from public.players where id = p_player;
  if v_team is null then raise exception 'player not found'; end if;
  if not app.is_team_admin(v_team) then raise exception 'not authorized'; end if;
  if p_role not in ('team_admin','player') then raise exception 'invalid role'; end if;

  v_raw := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.invites(team_id, player_id, role, email, token_hash, created_by, expires_at)
  values (v_team, p_player, p_role, p_email, extensions.digest(v_raw, 'sha256'), auth.uid(), now() + p_ttl);
  return v_raw;
end $$;

-- Invite einlösen (nach erstem OTP-Login)
create or replace function public.redeem_invite(p_raw_token text)
returns uuid
language plpgsql security definer set search_path = public, app, extensions as $$
declare v public.invites%rowtype;
begin
  select * into v from public.invites
   where token_hash = extensions.digest(p_raw_token, 'sha256')
     and accepted_at is null and revoked_at is null and expires_at > now()
   for update;
  if not found then raise exception 'invite invalid, expired, or already used'; end if;

  insert into public.profiles(id, email) values (auth.uid(), auth.jwt() ->> 'email') on conflict (id) do nothing;

  if v.player_id is not null then
    update public.players set user_id = auth.uid() where id = v.player_id and user_id is null;
    if not found then raise exception 'player already claimed'; end if;
  end if;

  insert into public.memberships(user_id, team_id, club_id, role)
  values (auth.uid(), v.team_id, v.club_id, v.role)
  on conflict do nothing;

  update public.invites set accepted_at = now(), accepted_by = auth.uid() where id = v.id;
  return coalesce(v.team_id, v.club_id);
end $$;

-- Vereins-Antrag freigeben (Plattform-Admin) → Club + club_admin-Membership
create or replace function public.approve_club_request(p_request uuid)
returns uuid
language plpgsql security definer set search_path = public, app as $$
declare v public.club_requests%rowtype; v_club uuid;
begin
  if not app.is_platform_admin() then raise exception 'not authorized'; end if;
  select * into v from public.club_requests where id = p_request and status = 'pending' for update;
  if not found then raise exception 'request not found or not pending'; end if;

  insert into public.clubs(name) values (v.club_name) returning id into v_club;
  insert into public.memberships(user_id, club_id, role) values (v.requested_by, v_club, 'club_admin');
  update public.club_requests set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() where id = v.id;
  return v_club;
end $$;

revoke all on function
  public.create_invite(uuid, public.role_type, text, interval),
  public.redeem_invite(text),
  public.approve_club_request(uuid)
  from public;
grant execute on function
  public.create_invite(uuid, public.role_type, text, interval),
  public.redeem_invite(text),
  public.approve_club_request(uuid)
  to authenticated;
