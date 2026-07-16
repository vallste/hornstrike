-- ============================================================================
-- Phase 6: Nutzungs-Analytics (Plattform-Admin)
--   1. app_events        – behavioraler Event-Log (append-only, admin-only lesbar)
--   2. created_by-Default – Spieltage/Umfragen automatisch dem Ersteller zuordnen
--   3. admin_usage_stats() – aggregierter Kennzahlen-Snapshot als jsonb
--
-- Einmalig im Supabase-SQL-Editor ausführen (läuft als postgres → die
-- SECURITY-DEFINER-Funktion darf auch auth.users lesen). NICHT idempotent.
-- gen_random_uuid() stammt aus pgcrypto (bereits in 0001 installiert).
-- ============================================================================

-- ── 1. app_events ────────────────────────────────────────────────────────────
-- Freitext-`type` + `meta jsonb` bewusst SCHEMALOS: neue Event-Typen brauchen
-- KEINE Migration. Dokumentierte (nicht erzwungene) Typen:
--   app_open, screen_view, lineup_generated, matchday_created, poll_created,
--   poll_responded, invite_created, invite_accepted, club_requested, pwa_installed
-- Regeln für `meta` (client-seitig durchgesetzt): NIEMALS PII (keine Emails/
-- Klarnamen); screen_view.meta.path muss de-identifiziert sein ('/players/:id').
create table public.app_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete set null,
  team_id     uuid references public.teams(id) on delete set null,
  club_id     uuid references public.clubs(id) on delete set null,
  type        text not null,
  meta        jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index app_events_occurred_idx      on public.app_events(occurred_at desc);
create index app_events_type_occurred_idx on public.app_events(type, occurred_at desc);
create index app_events_user_occurred_idx on public.app_events(user_id, occurred_at desc);

alter table public.app_events enable row level security;
grant select, insert on public.app_events to authenticated;   -- KEIN update/delete

-- INSERT: jeder eingeloggte User darf ausschließlich eigene Events schreiben.
create policy ae_insert on public.app_events for insert to authenticated
  with check (user_id = auth.uid());

-- SELECT: ausschließlich Plattform-Admin (das Dashboard liest ohnehin via RPC).
create policy ae_select on public.app_events for select to authenticated
  using (app.is_platform_admin());

-- Bewusst NICHT in supabase_realtime aufgenommen (admin-only, write-heavy).
-- Optionales Pruning (späterer pg_cron-Job) bei Bedarf:
--   delete from public.app_events where occurred_at < now() - interval '365 days';


-- ── 2. created_by automatisch stempeln ───────────────────────────────────────
-- Spalten existieren bereits (0001/0003), wurden vom Client nur nie gesetzt.
-- Default = auth.uid() → Ersteller-Attribution ohne Client-Änderung.
alter table public.matchdays alter column created_by set default auth.uid();
alter table public.polls     alter column created_by set default auth.uid();


-- ── 3. admin_usage_stats() ────────────────────────────────────────────────────
-- Ein einziger aggregierter Snapshot als jsonb. SECURITY DEFINER + Admin-Guard
-- (Muster wie approve_club_request). Snapshot-Sektionen (adoption/activation/
-- engagement/login/per_scope/health) beschreiben "jetzt"; range-Sektionen
-- (growth/events/recent) honorieren [p_from, p_to].
create or replace function public.admin_usage_stats(
  p_from timestamptz default (now() - interval '90 days'),
  p_to   timestamptz default now()
) returns jsonb
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_adoption   jsonb;
  v_growth     jsonb;
  v_activation jsonb;
  v_engagement jsonb;
  v_login      jsonb;
  v_events     jsonb;
  v_per_scope  jsonb;
  v_health     jsonb;
  v_recent     jsonb;
begin
  if not app.is_platform_admin() then
    raise exception 'not authorized';
  end if;

  -- ---- adoption (Snapshot) --------------------------------------------------
  select jsonb_build_object(
    'users_total',      (select count(*) from public.profiles),
    'platform_admins',  (select count(*) from public.profiles where is_platform_admin),
    'clubs_total',      (select count(*) from public.clubs),
    'teams_total',      (select count(*) from public.teams),
    'players_total',    (select count(*) from public.players),
    'players_active',   (select count(*) from public.players where active),
    'players_claimed',  (select count(*) from public.players where user_id is not null),
    'players_ghost',    (select count(*) from public.players where user_id is null),
    'memberships_by_role', (
      select coalesce(jsonb_object_agg(role::text, n), '{}'::jsonb)
      from (select role, count(*) n from public.memberships group by role) t
    ),
    'teams_per_club_avg',   (select coalesce(round(avg(cnt)::numeric, 2), 0)
                             from (select club_id, count(*) cnt from public.teams   group by club_id) t),
    'players_per_team_avg', (select coalesce(round(avg(cnt)::numeric, 2), 0)
                             from (select team_id, count(*) cnt from public.players group by team_id) t)
  ) into v_adoption;

  -- ---- growth (range, lückenlose Wochen-/Monatsreihen) ----------------------
  with kinds(k) as (values ('signups'),('clubs'),('teams'),('matchdays'),('polls')),
  src as (
    select date_trunc('week', created_at) bw, date_trunc('month', created_at) bm, 'signups'::text k
      from public.profiles  where created_at between p_from and p_to
    union all select date_trunc('week', created_at), date_trunc('month', created_at), 'clubs'
      from public.clubs     where created_at between p_from and p_to
    union all select date_trunc('week', created_at), date_trunc('month', created_at), 'teams'
      from public.teams     where created_at between p_from and p_to
    union all select date_trunc('week', created_at), date_trunc('month', created_at), 'matchdays'
      from public.matchdays where created_at between p_from and p_to
    union all select date_trunc('week', created_at), date_trunc('month', created_at), 'polls'
      from public.polls     where created_at between p_from and p_to
  ),
  gw as (select gs bucket from generate_series(date_trunc('week',  p_from), date_trunc('week',  p_to), interval '1 week')  gs),
  gm as (select gs bucket from generate_series(date_trunc('month', p_from), date_trunc('month', p_to), interval '1 month') gs),
  aw as (select bw b, k, count(*) n from src group by 1, 2),
  am as (select bm b, k, count(*) n from src group by 1, 2),
  weekly as (
    select k.k, jsonb_agg(jsonb_build_object('bucket', gw.bucket, 'count', coalesce(aw.n, 0)) order by gw.bucket) series
    from kinds k cross join gw left join aw on aw.b = gw.bucket and aw.k = k.k group by k.k
  ),
  monthly as (
    select k.k, jsonb_agg(jsonb_build_object('bucket', gm.bucket, 'count', coalesce(am.n, 0)) order by gm.bucket) series
    from kinds k cross join gm left join am on am.b = gm.bucket and am.k = k.k group by k.k
  )
  select jsonb_build_object(
    'weekly',  (select coalesce(jsonb_object_agg(k, series), '{}'::jsonb) from weekly),
    'monthly', (select coalesce(jsonb_object_agg(k, series), '{}'::jsonb) from monthly)
  ) into v_growth;

  -- ---- activation (Funnels) -------------------------------------------------
  select jsonb_build_object(
    'invites', (
      select jsonb_build_object(
        'created',  count(*),
        'accepted', count(*) filter (where accepted_at is not null),
        'revoked',  count(*) filter (where revoked_at  is not null),
        'expired',  count(*) filter (where accepted_at is null and revoked_at is null and expires_at < now()),
        'acceptance_rate', round(coalesce(count(*) filter (where accepted_at is not null)::numeric
                                          / nullif(count(*), 0), 0), 3),
        'median_seconds_to_accept', coalesce(round(
          percentile_cont(0.5) within group (order by extract(epoch from (accepted_at - created_at)))
            filter (where accepted_at is not null))::bigint, 0)
      ) from public.invites
    ),
    'club_requests', (
      select jsonb_build_object(
        'pending',  count(*) filter (where status = 'pending'),
        'approved', count(*) filter (where status = 'approved'),
        'rejected', count(*) filter (where status = 'rejected'),
        'approval_rate', round(coalesce(count(*) filter (where status = 'approved')::numeric
                                        / nullif(count(*) filter (where status in ('approved','rejected')), 0), 0), 3),
        'median_seconds_to_review', coalesce(round(
          percentile_cont(0.5) within group (order by extract(epoch from (reviewed_at - created_at)))
            filter (where reviewed_at is not null))::bigint, 0)
      ) from public.club_requests
    ),
    'account_adoption_ratio', (select round(coalesce(count(*) filter (where user_id is not null)::numeric
                                                     / nullif(count(*), 0), 0), 3) from public.players),
    'users_with_membership_ratio', round(coalesce(
       (select count(distinct user_id) from public.memberships)::numeric
       / nullif((select count(*) from public.profiles), 0), 0), 3)
  ) into v_activation;

  -- ---- engagement (Snapshot) ------------------------------------------------
  with la as (
    select t.id team_id, greatest(
      coalesce((select max(created_at) from public.matchdays m where m.team_id = t.id), to_timestamp(0)),
      coalesce((select max(created_at) from public.polls     p where p.team_id = t.id), to_timestamp(0)),
      coalesce((select max(pr.created_at) from public.poll_responses pr
                join public.poll_options o on o.id = pr.poll_option_id
                join public.polls p2 on p2.id = o.poll_id
                where p2.team_id = t.id), to_timestamp(0))
    ) last_activity
    from public.teams t
  )
  select jsonb_build_object(
    'matchdays_per_team_avg', (select coalesce(round(avg(cnt)::numeric, 2), 0)
                               from (select team_id, count(*) cnt from public.matchdays group by team_id) x),
    'polls_per_team_avg',     (select coalesce(round(avg(cnt)::numeric, 2), 0)
                               from (select team_id, count(*) cnt from public.polls group by team_id) x),
    'teams_active_30d',  (select count(*) from la where last_activity >= now() - interval '30 days'),
    'teams_dormant_30d', (select count(*) from la where last_activity <  now() - interval '30 days'),
    'teams_active_60d',  (select count(*) from la where last_activity >= now() - interval '60 days'),
    'teams_dormant_60d', (select count(*) from la where last_activity <  now() - interval '60 days'),
    'polls_with_response_ratio', round(coalesce(
        (select count(distinct o.poll_id) from public.poll_options o
         join public.poll_responses pr on pr.poll_option_id = o.id)::numeric
        / nullif((select count(*) from public.polls), 0), 0), 3),
    'response_status_mix', (
      select coalesce(jsonb_object_agg(status::text, n), '{}'::jsonb)
      from (select status, count(*) n from public.poll_responses group by status) t
    ),
    'goalie_usage_rate',       (select round(coalesce(count(*) filter (where use_goalie)::numeric
                                                      / nullif(count(*), 0), 0), 3) from public.matchdays),
    'fifth_double_usage_rate', (select round(coalesce(count(*) filter (where use_fifth_double)::numeric
                                                      / nullif(count(*), 0), 0), 3) from public.matchdays)
  ) into v_engagement;

  -- ---- login (aus auth.users – nur via DEFINER erreichbar) ------------------
  select jsonb_build_object(
    'signups_total',   count(*),
    'active_1d',       count(*) filter (where last_sign_in_at >= now() - interval '1 day'),
    'active_7d',       count(*) filter (where last_sign_in_at >= now() - interval '7 days'),
    'active_30d',      count(*) filter (where last_sign_in_at >= now() - interval '30 days'),
    'never_signed_in', count(*) filter (where last_sign_in_at is null),
    'email_confirmed', count(*) filter (where email_confirmed_at is not null),
    'email_confirmed_rate', round(coalesce(count(*) filter (where email_confirmed_at is not null)::numeric
                                           / nullif(count(*), 0), 0), 3),
    '_note', 'last_sign_in_at speichert nur den letzten Login; echte tägliche Aktive via events.dau_series'
  ) into v_login
  from auth.users;

  -- ---- events (range, aus app_events) ---------------------------------------
  with ev as (select * from public.app_events where occurred_at between p_from and p_to),
  days as (select d::date as dd from generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day') d),
  per_day as (select occurred_at::date d, count(*) c from ev group by 1),
  dau as (select occurred_at::date d, count(distinct user_id) u from ev group by 1)
  select jsonb_build_object(
    'counts_by_type', (select coalesce(jsonb_object_agg(type, n), '{}'::jsonb)
                       from (select type, count(*) n from ev group by type) t),
    'per_day',    (select coalesce(jsonb_agg(jsonb_build_object('day', days.dd, 'count', coalesce(per_day.c, 0)) order by days.dd), '[]'::jsonb)
                   from days left join per_day on per_day.d = days.dd),
    'dau_series', (select coalesce(jsonb_agg(jsonb_build_object('day', days.dd, 'users', coalesce(dau.u, 0)) order by days.dd), '[]'::jsonb)
                   from days left join dau on dau.d = days.dd),
    'wau', (select count(distinct user_id) from public.app_events where occurred_at >= now() - interval '7 days'),
    'mau', (select count(distinct user_id) from public.app_events where occurred_at >= now() - interval '30 days'),
    'top_screens', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'count', n) order by n desc), '[]'::jsonb)
      from (select meta->>'path' path, count(*) n from public.app_events
            where type = 'screen_view' and occurred_at between p_from and p_to and meta ? 'path'
            group by 1 order by n desc limit 15) s
    )
  ) into v_events;

  -- ---- per_scope (pro Team, mit Verein) -------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'club_name', c.name, 'team_name', t.name,
           'players', pc.n, 'members', mc.n, 'matchdays', mdc.n, 'polls', plc.n,
           'last_activity', nullif(la.last_activity, to_timestamp(0))
         ) order by la.last_activity desc), '[]'::jsonb) into v_per_scope
  from public.teams t
  join public.clubs c on c.id = t.club_id
  cross join lateral (select count(*) n from public.players     where team_id = t.id) pc
  cross join lateral (select count(*) n from public.memberships where team_id = t.id) mc
  cross join lateral (select count(*) n from public.matchdays   where team_id = t.id) mdc
  cross join lateral (select count(*) n from public.polls       where team_id = t.id) plc
  cross join lateral (select greatest(
      coalesce((select max(created_at) from public.matchdays where team_id = t.id), to_timestamp(0)),
      coalesce((select max(created_at) from public.polls     where team_id = t.id), to_timestamp(0)),
      coalesce((select max(pr.created_at) from public.poll_responses pr
                join public.poll_options o on o.id = pr.poll_option_id
                join public.polls p2 on p2.id = o.poll_id
                where p2.team_id = t.id), to_timestamp(0))
    ) last_activity) la;

  -- ---- health / ops (Snapshot) ----------------------------------------------
  select jsonb_build_object(
    'teams_without_players', (select count(*) from public.teams t where not exists (select 1 from public.players p where p.team_id = t.id)),
    'clubs_without_teams',   (select count(*) from public.clubs c where not exists (select 1 from public.teams  t where t.club_id = c.id)),
    'players_never_claimed', (select count(*) from public.players where user_id is null),
    'polls_without_responses', (select count(*) from public.polls p where not exists (
       select 1 from public.poll_options o join public.poll_responses pr on pr.poll_option_id = o.id where o.poll_id = p.id)),
    'club_requests_pending', (select count(*) from public.club_requests where status = 'pending'),
    'club_requests_oldest_pending_seconds', (select coalesce(round(extract(epoch from (now() - min(created_at))))::bigint, 0)
                                             from public.club_requests where status = 'pending'),
    'invites_pending',     (select count(*) from public.invites where accepted_at is null and revoked_at is null and expires_at >= now()),
    'invites_expiring_7d', (select count(*) from public.invites where accepted_at is null and revoked_at is null and expires_at between now() and now() + interval '7 days'),
    'invites_expired',     (select count(*) from public.invites where accepted_at is null and revoked_at is null and expires_at < now())
  ) into v_health;

  -- ---- recent (range, Puls) -------------------------------------------------
  select jsonb_build_object(
    'signups', (select coalesce(jsonb_agg(jsonb_build_object('at', created_at,
                 'label', coalesce(display_name, split_part(email, '@', 1))) order by created_at desc), '[]'::jsonb)
                from (select created_at, display_name, email from public.profiles order by created_at desc limit 10) s),
    'matchdays', (select coalesce(jsonb_agg(jsonb_build_object('at', md.created_at,
                   'label', t.name || coalesce(' – ' || md.opponent, '')) order by md.created_at desc), '[]'::jsonb)
                  from (select * from public.matchdays order by created_at desc limit 10) md
                  join public.teams t on t.id = md.team_id),
    'polls', (select coalesce(jsonb_agg(jsonb_build_object('at', p.created_at,
               'label', t.name || ' – ' || p.title) order by p.created_at desc), '[]'::jsonb)
              from (select * from public.polls order by created_at desc limit 10) p
              join public.teams t on t.id = p.team_id),
    'club_requests', (select coalesce(jsonb_agg(jsonb_build_object('at', created_at,
                       'label', club_name || ' (' || status::text || ')') order by created_at desc), '[]'::jsonb)
                      from (select * from public.club_requests order by created_at desc limit 10) cr)
  ) into v_recent;

  return jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object('from', p_from, 'to', p_to,
                                'days', round(extract(epoch from (p_to - p_from)) / 86400)),
    'adoption',   v_adoption,
    'growth',     v_growth,
    'activation', v_activation,
    'engagement', v_engagement,
    'login',      v_login,
    'events',     v_events,
    'per_scope',  v_per_scope,
    'health',     v_health,
    'recent',     v_recent
  );
end;
$$;

revoke all on function public.admin_usage_stats(timestamptz, timestamptz) from public;
grant execute on function public.admin_usage_stats(timestamptz, timestamptz) to authenticated;
