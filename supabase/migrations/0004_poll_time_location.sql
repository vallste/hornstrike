-- ============================================================================
-- Uhrzeit + Spielort für Umfragen, Termine und Spieltage.
-- Default auf der Umfrage, optionale Abweichung pro Termin; fließt in den Spieltag.
-- Einmalig im SQL-Editor ausführen.
-- ============================================================================
alter table public.polls        add column default_time time, add column default_location text;
alter table public.poll_options add column start_time  time, add column location        text;
alter table public.matchdays    add column start_time  time, add column location        text;
