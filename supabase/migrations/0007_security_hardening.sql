-- ============================================================================
-- Phase 7: Sicherheits-/Datenschutz-Härtung (aus dem Pre-Launch-Audit)
--   Einmalig im Supabase-SQL-Editor ausführen. Setzt auf 0001..0006 auf.
-- ============================================================================

-- M1 / L6 (Blocker): app_events.user_id war NOT NULL trotz ON DELETE SET NULL
-- → Konto-/DSGVO-Löschung (Art. 17) schlägt fehl, sobald Events existieren.
-- Nullable machen, damit SET NULL greift (Events bleiben anonymisiert erhalten).
alter table public.app_events alter column user_id drop not null;

-- L3: app_events gegen Flutung/Vergiftung absichern (Feldgrößen begrenzen).
alter table public.app_events add constraint app_events_type_len  check (char_length(type) <= 64);
alter table public.app_events add constraint app_events_meta_size check (pg_column_size(meta) < 2048);

-- L5: INSERT-Scope binden – Events nur für Teams/Vereine, denen der Nutzer
-- angehört (schließt Cross-Tenant-Zuordnung). Bricht legitimes Tracking nicht,
-- da der Client team_id/club_id aus dem eigenen Scope sendet.
drop policy ae_insert on public.app_events;
create policy ae_insert on public.app_events for insert to authenticated
  with check (
    user_id = auth.uid()
    and (team_id is null or app.is_team_member(team_id))
    and (club_id is null or app.is_club_admin(club_id)
         or exists (select 1 from public.teams t where t.club_id = club_id and app.is_team_member(t.id)))
  );

-- L2: Einladungen mit hinterlegter E-Mail an genau diese E-Mail binden – eine
-- weitergeleitete Einladung übernimmt dann kein fremdes Profil mehr. Einladungen
-- OHNE E-Mail (Copy-Paste-/WhatsApp-Flow) bleiben unverändert einlösbar.
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

  -- Neu: E-Mail-Bindung, falls die Einladung an eine bestimmte Adresse ging.
  if v.email is not null and lower(v.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'invite email mismatch';
  end if;

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

-- L4: Speicherbegrenzung für app_events → aktiv in 0008_app_events_retention.sql
--     (180 Tage, täglicher pg_cron-Job; in der Datenschutzerklärung benannt).
