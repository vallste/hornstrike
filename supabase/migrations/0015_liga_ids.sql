-- ============================================================================
-- Phase 12: Verknüpfung mit den Liga-Seiten des Tischfußballverbands Hamburg.
--   NACH 0014 ausführen. Einmalig im Supabase-SQL-Editor.
--
--   - players.liga_player_id → kickern-hamburg.de/liga/spielerstatistiken
--                              ?task=spieler_details&id=<id>
--   - teams.liga_team_id     → kickern-hamburg.de/liga/ergebnisse-und-tabellen
--                              ?task=team_details&id=<id>
--
--   Gespeichert wird ausschließlich die Zahl, nie eine URL: die Basis-Adresse
--   steht im Client (src/lib/liga.ts). So kann über dieses Feld keine fremde
--   Adresse in die App geschmuggelt werden, und ein Pfadwechsel beim Verband
--   kostet nur eine Zeile im Frontend statt eine Datenwanderung.
--
--   Es werden KEINE Daten von dort abgerufen – die App verlinkt nur.
-- ============================================================================

alter table public.players add column if not exists liga_player_id integer;
alter table public.teams   add column if not exists liga_team_id   integer;

alter table public.players drop constraint if exists players_liga_player_id_positive;
alter table public.players add  constraint players_liga_player_id_positive
  check (liga_player_id is null or liga_player_id > 0);

alter table public.teams drop constraint if exists teams_liga_team_id_positive;
alter table public.teams add  constraint teams_liga_team_id_positive
  check (liga_team_id is null or liga_team_id > 0);

-- players.liga_player_id braucht keinen eigenen Weg: die players_update-Policy
-- erlaubt bereits app.is_team_editor ODER die eigene Zeile – also genau
-- „man selbst, Captain oder Co-Captain", wie beim übrigen Spielerprofil.

-- teams.* ist per teams_update nur für Vereins-Admins schreibbar. Wie beim
-- Team-Logo (set_team_avatar, 0013) öffnet ein schmaler RPC genau dieses eine
-- Feld – hier bewusst über is_team_editor, damit auch der Co-Captain die ID
-- eintragen darf. Das Umbenennen-Recht bleibt davon unberührt.
create or replace function public.set_team_liga_id(p_team uuid, p_id integer) returns void
language plpgsql security definer set search_path = public, app as $$
begin
  if not app.is_team_editor(p_team) then raise exception 'not authorized'; end if;
  if p_id is not null and p_id <= 0 then raise exception 'invalid liga id'; end if;
  update public.teams set liga_team_id = p_id where id = p_team;
end $$;
revoke all on function public.set_team_liga_id(uuid, integer) from public;
grant execute on function public.set_team_liga_id(uuid, integer) to authenticated;
