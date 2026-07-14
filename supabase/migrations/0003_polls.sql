-- ============================================================================
-- Phase 3: Terminfindung (Doodle-artige Verfügbarkeits-Umfrage pro Team)
-- Enums + polls / poll_options / poll_responses + RLS + GRANTs + Realtime.
-- Einmalig im SQL-Editor ausführen.
-- ============================================================================

create type public.poll_status         as enum ('open','closed');
create type public.availability_status as enum ('available','maybe','no');

-- ── Tabellen ─────────────────────────────────────────────────────────────────
create table public.polls (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  title      text not null,
  status     public.poll_status not null default 'open',
  deadline   timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index polls_team_idx on public.polls(team_id);

create table public.poll_options (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid not null references public.polls(id) on delete cascade,
  proposed_date date not null,
  label         text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (poll_id, proposed_date)
);
create index poll_options_poll_idx on public.poll_options(poll_id);

create table public.poll_responses (
  id             uuid primary key default gen_random_uuid(),
  poll_option_id uuid not null references public.poll_options(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  status         public.availability_status not null,
  comment        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (poll_option_id, player_id)
);
create index poll_responses_option_idx on public.poll_responses(poll_option_id);

create trigger t_polls_upd          before update on public.polls          for each row execute function public.set_updated_at();
create trigger t_poll_responses_upd before update on public.poll_responses for each row execute function public.set_updated_at();

-- ── RLS + GRANTS ─────────────────────────────────────────────────────────────
alter table public.polls enable row level security;
grant select, insert, update, delete on public.polls to authenticated;
create policy polls_select on public.polls for select to authenticated using (app.is_team_member(team_id));
create policy polls_insert on public.polls for insert to authenticated with check (app.is_team_admin(team_id));
create policy polls_update on public.polls for update to authenticated using (app.is_team_admin(team_id)) with check (app.is_team_admin(team_id));
create policy polls_delete on public.polls for delete to authenticated using (app.is_team_admin(team_id));

alter table public.poll_options enable row level security;
grant select, insert, update, delete on public.poll_options to authenticated;
create policy po_select on public.poll_options for select to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id and app.is_team_member(p.team_id)));
create policy po_write on public.poll_options for all to authenticated
  using (exists (select 1 from public.polls p where p.id = poll_id and app.is_team_admin(p.team_id)))
  with check (exists (select 1 from public.polls p where p.id = poll_id and app.is_team_admin(p.team_id)));

alter table public.poll_responses enable row level security;
grant select, insert, update, delete on public.poll_responses to authenticated;
create policy pr_select on public.poll_responses for select to authenticated
  using (exists (
    select 1 from public.poll_options o join public.polls p on p.id = o.poll_id
    where o.id = poll_option_id and app.is_team_member(p.team_id)
  ));
create policy pr_write on public.poll_responses for all to authenticated
  using (app.can_edit_player(player_id))
  with check (
    app.can_edit_player(player_id)
    and exists (  -- Antwort-Spieler muss zum Team der Umfrage gehören
      select 1 from public.poll_options o
        join public.polls p on p.id = o.poll_id
        join public.players pl on pl.id = poll_responses.player_id
      where o.id = poll_option_id and pl.team_id = p.team_id
    )
  );

-- ── Realtime (Live-Umfragen + Live-Ergebnisse) ───────────────────────────────
alter publication supabase_realtime add table public.polls;
alter publication supabase_realtime add table public.poll_responses;
