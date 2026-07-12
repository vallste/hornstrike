-- ============================================================================
-- EINMALIGER Import der Fellow-Unicorns-Daten (aus localStorage-Backup).
-- Im SQL-Editor ausführen (läuft als postgres → umgeht RLS).
-- UUIDs bleiben erhalten. Idempotent: bricht ab, wenn das Team schon existiert.
-- ⚠️ v_email unten = die Mail, mit der DU dich in der App eingeloggt hast.
-- ============================================================================
do $$
declare
  v_email text := 'stephan.winkelmann@gmail.com';  -- <-- ggf. anpassen
  v_club  uuid := 'a0000000-0000-4000-8000-000000000001';
  v_team  uuid := 'a0000000-0000-4000-8000-000000000002';
  v_user  uuid;
begin
  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    raise exception 'Kein auth.users-Eintrag für %, bitte v_email anpassen', v_email;
  end if;
  if exists (select 1 from public.teams where id = v_team) then
    raise notice 'Team existiert bereits – Import übersprungen.';
    return;
  end if;

  -- Verein + Team + Captain-Membership
  insert into public.clubs(id, name) values (v_club, 'Fellow Unicorns');
  insert into public.teams(id, club_id, name, league) values (v_team, v_club, 'Fellow Unicorns', 'Hamburger Liga');
  insert into public.memberships(user_id, team_id, role) values (v_user, v_team, 'team_admin');

  -- Spieler (Stephan mit user_id verknüpft, Rest Ghosts)
  insert into public.players(id, team_id, user_id, name, active, sort_order) values
    ('7d12b912-b925-46bb-9447-2d9a8dbfb487', v_team, null,   'René',    true, 0),
    ('cd87f5fa-2206-4a9f-b20d-e1871bfd2c2b', v_team, null,   'Patrick', true, 1),
    ('38e3ceba-a8e9-4098-b97b-e0278d16ebd8', v_team, null,   'Lisa',    true, 2),
    ('e5491575-123a-4d4d-8893-f5f599b16934', v_team, null,   'Fabian',  true, 3),
    ('937a1007-4e67-4d8b-8c80-aeec12753ec7', v_team, null,   'Dennis',  true, 4),
    ('02df2297-d3c6-47e6-9b8e-463ddd832ea4', v_team, null,   'Steffi',  true, 5),
    ('3a7ba006-1046-4c64-a98c-d1317e4117ec', v_team, v_user, 'Stephan', true, 6);

  -- Dauerpräferenzen
  insert into public.player_preferences(player_id, position, game_type, goalie_preference, avoids_opening, avoids_closing) values
    ('7d12b912-b925-46bb-9447-2d9a8dbfb487', 'defense',           'doubles_preferred', false, false, false),
    ('cd87f5fa-2206-4a9f-b20d-e1871bfd2c2b', 'attack_preferred',  'both',              false, false, false),
    ('38e3ceba-a8e9-4098-b97b-e0278d16ebd8', 'attack',            'doubles_preferred', false, true,  true),
    ('e5491575-123a-4d4d-8893-f5f599b16934', 'defense',           'both',              false, false, false),
    ('937a1007-4e67-4d8b-8c80-aeec12753ec7', 'both',              'both',              false, false, false),
    ('02df2297-d3c6-47e6-9b8e-463ddd832ea4', 'defense_preferred', 'both',              false, false, false),
    ('3a7ba006-1046-4c64-a98c-d1317e4117ec', 'both',              'both',              true,  false, false);

  -- Partnerwunsch: Lisa → Stephan (Gewicht 2)
  insert into public.partner_preferences(player_id, partner_player_id, weight) values
    ('38e3ceba-a8e9-4098-b97b-e0278d16ebd8', '3a7ba006-1046-4c64-a98c-d1317e4117ec', 2);

  -- Spieltage (lineup als JSONB-Snapshot verbatim)
  insert into public.matchdays(id, team_id, date, opponent, use_goalie, use_fifth_double, lineup, created_by) values
    ('866ace5e-1d39-463e-ba79-46afc8c37b4f', v_team, '2026-05-28', 'Gute Gegner', false, false,
     '[{"gameIndex":1,"type":"singles","isGoalieSingles":false,"players":["cd87f5fa-2206-4a9f-b20d-e1871bfd2c2b"],"positions":[]},{"gameIndex":2,"type":"singles","isGoalieSingles":false,"players":["937a1007-4e67-4d8b-8c80-aeec12753ec7"],"positions":[]},{"gameIndex":3,"type":"doubles","players":["38e3ceba-a8e9-4098-b97b-e0278d16ebd8","3a7ba006-1046-4c64-a98c-d1317e4117ec"],"positions":["attack","defense"]},{"gameIndex":4,"type":"singles","isGoalieSingles":false,"players":["02df2297-d3c6-47e6-9b8e-463ddd832ea4"],"positions":[]},{"gameIndex":5,"type":"singles","isGoalieSingles":false,"players":["e5491575-123a-4d4d-8893-f5f599b16934"],"positions":[]},{"gameIndex":6,"type":"doubles","isGoalieSingles":false,"players":["7d12b912-b925-46bb-9447-2d9a8dbfb487","cd87f5fa-2206-4a9f-b20d-e1871bfd2c2b"],"positions":["attack","defense"]},{"gameIndex":7,"type":"singles","isGoalieSingles":false,"players":["937a1007-4e67-4d8b-8c80-aeec12753ec7"],"positions":[]},{"gameIndex":8,"type":"singles","isGoalieSingles":false,"players":["02df2297-d3c6-47e6-9b8e-463ddd832ea4"],"positions":[]},{"gameIndex":9,"type":"doubles","players":["38e3ceba-a8e9-4098-b97b-e0278d16ebd8","e5491575-123a-4d4d-8893-f5f599b16934"],"positions":["attack","defense"]},{"gameIndex":10,"type":"singles","isGoalieSingles":false,"players":["3a7ba006-1046-4c64-a98c-d1317e4117ec"],"positions":[]},{"gameIndex":11,"type":"singles","isGoalieSingles":false,"players":["7d12b912-b925-46bb-9447-2d9a8dbfb487"],"positions":[]},{"gameIndex":12,"type":"doubles","players":["937a1007-4e67-4d8b-8c80-aeec12753ec7","02df2297-d3c6-47e6-9b8e-463ddd832ea4"],"positions":["attack","defense"]}]'::jsonb,
     v_user),
    ('2e8397dc-46cd-4762-a040-39962c08d9c7', v_team, '2026-06-09', 'Boltens', false, true,
     '[{"gameIndex":1,"type":"singles","isGoalieSingles":false,"players":["3a7ba006-1046-4c64-a98c-d1317e4117ec"],"positions":[]},{"gameIndex":2,"type":"singles","isGoalieSingles":false,"players":["02df2297-d3c6-47e6-9b8e-463ddd832ea4"],"positions":[]},{"gameIndex":3,"type":"doubles","players":["7d12b912-b925-46bb-9447-2d9a8dbfb487","38e3ceba-a8e9-4098-b97b-e0278d16ebd8"],"positions":["defense","attack"]},{"gameIndex":4,"type":"singles","isGoalieSingles":false,"players":["e5491575-123a-4d4d-8893-f5f599b16934"],"positions":[]},{"gameIndex":5,"type":"singles","isGoalieSingles":false,"players":["3a7ba006-1046-4c64-a98c-d1317e4117ec"],"positions":[]},{"gameIndex":6,"type":"doubles","players":["e5491575-123a-4d4d-8893-f5f599b16934","937a1007-4e67-4d8b-8c80-aeec12753ec7"],"positions":["defense","attack"]},{"gameIndex":7,"type":"singles","isGoalieSingles":false,"players":["02df2297-d3c6-47e6-9b8e-463ddd832ea4"],"positions":[]},{"gameIndex":8,"type":"singles","isGoalieSingles":false,"players":["38e3ceba-a8e9-4098-b97b-e0278d16ebd8"],"positions":[]},{"gameIndex":9,"type":"doubles","players":["7d12b912-b925-46bb-9447-2d9a8dbfb487","937a1007-4e67-4d8b-8c80-aeec12753ec7"],"positions":["defense","attack"]},{"gameIndex":10,"type":"doubles","players":["02df2297-d3c6-47e6-9b8e-463ddd832ea4","3a7ba006-1046-4c64-a98c-d1317e4117ec"],"positions":["defense","attack"]},{"gameIndex":11,"type":"doubles","players":["38e3ceba-a8e9-4098-b97b-e0278d16ebd8","e5491575-123a-4d4d-8893-f5f599b16934"],"positions":["attack","defense"]}]'::jsonb,
     v_user),
    ('9aaa9e2b-9e00-49a2-83e3-abdb7bd6eae0', v_team, '2026-07-09', null, false, true,
     '[{"gameIndex":1,"type":"singles","isGoalieSingles":false,"players":["cd87f5fa-2206-4a9f-b20d-e1871bfd2c2b"],"positions":[]},{"gameIndex":2,"type":"singles","isGoalieSingles":false,"players":["3a7ba006-1046-4c64-a98c-d1317e4117ec"],"positions":[]},{"gameIndex":3,"type":"doubles","players":["7d12b912-b925-46bb-9447-2d9a8dbfb487","38e3ceba-a8e9-4098-b97b-e0278d16ebd8"],"positions":["defense","attack"]},{"gameIndex":4,"type":"doubles","players":["cd87f5fa-2206-4a9f-b20d-e1871bfd2c2b","e5491575-123a-4d4d-8893-f5f599b16934"],"positions":["attack","defense"]},{"gameIndex":5,"type":"doubles","players":["38e3ceba-a8e9-4098-b97b-e0278d16ebd8","3a7ba006-1046-4c64-a98c-d1317e4117ec"],"positions":["attack","defense"]},{"gameIndex":6,"type":"singles","isGoalieSingles":false,"players":["e5491575-123a-4d4d-8893-f5f599b16934"],"positions":[]},{"gameIndex":7,"type":"singles","isGoalieSingles":false,"players":["7d12b912-b925-46bb-9447-2d9a8dbfb487"],"positions":[]},{"gameIndex":8,"type":"doubles","players":["7d12b912-b925-46bb-9447-2d9a8dbfb487","cd87f5fa-2206-4a9f-b20d-e1871bfd2c2b"],"positions":["defense","attack"]},{"gameIndex":9,"type":"singles","isGoalieSingles":false,"players":["3a7ba006-1046-4c64-a98c-d1317e4117ec"],"positions":[]},{"gameIndex":10,"type":"singles","isGoalieSingles":false,"players":["e5491575-123a-4d4d-8893-f5f599b16934"],"positions":[]},{"gameIndex":11,"type":"doubles","players":["e5491575-123a-4d4d-8893-f5f599b16934","3a7ba006-1046-4c64-a98c-d1317e4117ec"],"positions":["defense","attack"]}]'::jsonb,
     v_user);

  -- Spieltag-Verfügbarkeiten
  insert into public.matchday_players(matchday_id, player_id, available_from, available_to) values
    -- 2026-05-28 (alle 1–12)
    ('866ace5e-1d39-463e-ba79-46afc8c37b4f','7d12b912-b925-46bb-9447-2d9a8dbfb487',1,12),
    ('866ace5e-1d39-463e-ba79-46afc8c37b4f','cd87f5fa-2206-4a9f-b20d-e1871bfd2c2b',1,12),
    ('866ace5e-1d39-463e-ba79-46afc8c37b4f','38e3ceba-a8e9-4098-b97b-e0278d16ebd8',1,12),
    ('866ace5e-1d39-463e-ba79-46afc8c37b4f','e5491575-123a-4d4d-8893-f5f599b16934',1,12),
    ('866ace5e-1d39-463e-ba79-46afc8c37b4f','937a1007-4e67-4d8b-8c80-aeec12753ec7',1,12),
    ('866ace5e-1d39-463e-ba79-46afc8c37b4f','02df2297-d3c6-47e6-9b8e-463ddd832ea4',1,12),
    ('866ace5e-1d39-463e-ba79-46afc8c37b4f','3a7ba006-1046-4c64-a98c-d1317e4117ec',1,12),
    -- 2026-06-09 (Dennis erst ab 6)
    ('2e8397dc-46cd-4762-a040-39962c08d9c7','7d12b912-b925-46bb-9447-2d9a8dbfb487',1,12),
    ('2e8397dc-46cd-4762-a040-39962c08d9c7','38e3ceba-a8e9-4098-b97b-e0278d16ebd8',1,12),
    ('2e8397dc-46cd-4762-a040-39962c08d9c7','e5491575-123a-4d4d-8893-f5f599b16934',1,12),
    ('2e8397dc-46cd-4762-a040-39962c08d9c7','937a1007-4e67-4d8b-8c80-aeec12753ec7',6,12),
    ('2e8397dc-46cd-4762-a040-39962c08d9c7','02df2297-d3c6-47e6-9b8e-463ddd832ea4',1,12),
    ('2e8397dc-46cd-4762-a040-39962c08d9c7','3a7ba006-1046-4c64-a98c-d1317e4117ec',1,12),
    -- 2026-07-09
    ('9aaa9e2b-9e00-49a2-83e3-abdb7bd6eae0','7d12b912-b925-46bb-9447-2d9a8dbfb487',1,12),
    ('9aaa9e2b-9e00-49a2-83e3-abdb7bd6eae0','cd87f5fa-2206-4a9f-b20d-e1871bfd2c2b',1,12),
    ('9aaa9e2b-9e00-49a2-83e3-abdb7bd6eae0','38e3ceba-a8e9-4098-b97b-e0278d16ebd8',1,12),
    ('9aaa9e2b-9e00-49a2-83e3-abdb7bd6eae0','e5491575-123a-4d4d-8893-f5f599b16934',1,12),
    ('9aaa9e2b-9e00-49a2-83e3-abdb7bd6eae0','3a7ba006-1046-4c64-a98c-d1317e4117ec',1,12);

  raise notice 'Import ok: Verein/Team/7 Spieler/3 Spieltage angelegt.';
end $$;
