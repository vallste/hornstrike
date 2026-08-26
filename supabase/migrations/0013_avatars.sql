-- ============================================================================
-- Phase 10: Profilbilder für Verein / Team / Spieler (privat, teamintern).
--   NACH 0012 ausführen. Einmalig im Supabase-SQL-Editor.
--
--   - PRIVATER Storage-Bucket 'avatars' (nicht öffentlich). Bilder sind nur für
--     Mitglieder des jeweiligen Teams/Vereins lesbar (Storage-RLS) → Anzeige im
--     Client über kurzlebige signierte URLs.
--   - Pfad-Konvention (Objektname): 'players/<uuid>' | 'teams/<uuid>' |
--     'clubs/<uuid>'  (KEINE Dateiendung → eindeutig pro Entität, Überschreiben
--     beim Neu-Upload).
--   - In der DB steht nur der Pfad (avatar_path), nie eine URL.
--   - Schreibrechte: Spieler-Avatar = can_edit_player (man selbst oder Captain/
--     Co-Captain), Team-Logo = Captain+ (via RPC), Vereinslogo = Vereins-Admin+.
--
--   BEWUSSTE ENTSCHEIDUNG: keine Aufräum-Trigger. Wird ein Spieler/Team/Verein
--   gelöscht, bleibt die Bilddatei im Bucket liegen (verwaist, aber durch RLS
--   für niemanden mehr lesbar, weil die Zeile fehlt). Beim Neu-Upload wird
--   dieselbe Datei überschrieben, es wächst also nichts pro Änderung. Ein
--   Aufräumen bräuchte einen Storage-Zugriff aus Postgres heraus – dafür
--   lieber später ein Wartungs-Skript als ein Trigger mit Fremdzugriff.
--
--   FALLS `create policy … on storage.objects` mit „must be owner of table
--   objects" abbricht: Das ist eine Ownership-Eigenheit mancher Projekte. Der
--   restliche Teil der Migration läuft davon unabhängig – die vier Policies
--   dann im Dashboard unter Storage → Policies mit denselben Ausdrücken
--   anlegen (app.can_read_avatar(name) bzw. app.can_write_avatar(name)).
-- ============================================================================

-- ── Spalten (Storage-Pfad, kein URL) ─────────────────────────────────────────
alter table public.clubs   add column if not exists avatar_path text;
alter table public.teams   add column if not exists avatar_path text;
alter table public.players add column if not exists avatar_path text;

-- ── Privater Bucket ──────────────────────────────────────────────────────────
--   file_size_limit/allowed_mime_types gehören zur Sicherheitsgrenze, nicht nur
--   zum Komfort: ohne MIME-Allowlist könnte ein Team-Editor ein SVG ablegen
--   (Pfade tragen bewusst keine Endung) – über eine signierte URL ausgeliefert
--   führt das Skript im Kontext der Storage-Domain aus. Nur Raster-Bilder.
--   `do update` statt `do nothing`, damit die Limits auch greifen, wenn der
--   Bucket bereits existiert (sonst bliebe er unbegrenzt).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public             = false,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Pfad-Parser: 'kind/<uuid>' → uuid (oder NULL bei Fehlformat) ──────────────
create or replace function app.avatar_path_id(p_name text, p_kind text) returns uuid
language plpgsql immutable set search_path = public, app as $$
declare parts text[];
begin
  parts := string_to_array(p_name, '/');
  if array_length(parts, 1) <> 2 or parts[1] <> p_kind then return null; end if;
  begin
    return parts[2]::uuid;
  exception when others then
    return null;
  end;
end $$;

-- ── Lese-/Schreibrecht je Objekt (SECURITY DEFINER → nutzt RLS-Helfer) ────────
-- Lesen: Mitglied des Teams (Spieler/Team) bzw. des Vereins (irgendein Team).
create or replace function app.can_read_avatar(p_name text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select case
    when p_name like 'players/%' then exists (
      select 1 from public.players pl
      where pl.id = app.avatar_path_id(p_name, 'players') and app.is_team_member(pl.team_id))
    when p_name like 'teams/%' then app.is_team_member(app.avatar_path_id(p_name, 'teams'))
    when p_name like 'clubs/%' then
      app.is_club_admin(app.avatar_path_id(p_name, 'clubs'))
      or exists (select 1 from public.teams t
                 where t.club_id = app.avatar_path_id(p_name, 'clubs') and app.is_team_member(t.id))
    else false
  end;
$$;

-- Schreiben: Bearbeitungsrecht der jeweiligen Entität.
create or replace function app.can_write_avatar(p_name text) returns boolean
language sql stable security definer set search_path = public, app as $$
  select case
    when p_name like 'players/%' then app.can_edit_player(app.avatar_path_id(p_name, 'players'))
    when p_name like 'teams/%'   then app.is_team_admin(app.avatar_path_id(p_name, 'teams'))
    when p_name like 'clubs/%'   then app.is_club_admin(app.avatar_path_id(p_name, 'clubs'))
    else false
  end;
$$;

revoke all on function app.avatar_path_id(text, text) from public;
revoke all on function app.can_read_avatar(text)      from public;
revoke all on function app.can_write_avatar(text)     from public;
grant execute on function app.avatar_path_id(text, text) to authenticated;
grant execute on function app.can_read_avatar(text)      to authenticated;
grant execute on function app.can_write_avatar(text)     to authenticated;

-- ── Storage-RLS auf dem Bucket 'avatars' ─────────────────────────────────────
drop policy if exists avatars_read   on storage.objects;
drop policy if exists avatars_insert on storage.objects;
drop policy if exists avatars_update on storage.objects;
drop policy if exists avatars_delete on storage.objects;

create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and app.can_read_avatar(name));
create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and app.can_write_avatar(name));
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and app.can_write_avatar(name))
  with check (bucket_id = 'avatars' and app.can_write_avatar(name));
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and app.can_write_avatar(name));

-- ── Team-Logo setzen (Captain+): teams.avatar_path ist sonst nur für ──────────
--    Vereins-Admins schreibbar (teams_update). Dieser RPC erlaubt Captains,
--    NUR das Logo zu setzen, ohne das Umbenennen-Recht aufzuweichen.
create or replace function public.set_team_avatar(p_team uuid, p_path text) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if not app.is_team_admin(p_team) then raise exception 'not authorized'; end if;
  update public.teams set avatar_path = p_path where id = p_team;
end $$;
revoke all on function public.set_team_avatar(uuid, text) from public;
grant execute on function public.set_team_avatar(uuid, text) to authenticated;
