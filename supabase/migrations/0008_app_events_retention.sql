-- ============================================================================
-- Phase 8: Speicherbegrenzung für app_events (DSGVO Art. 5(1)(e))
--   Nutzungsereignisse werden nach 180 Tagen automatisch gelöscht.
--   Einmalig im Supabase-SQL-Editor ausführen (idempotent, darf wiederholt
--   werden). Frist ist in der Datenschutzerklärung benannt.
-- ============================================================================

-- pg_cron aktivieren (alternativ: Dashboard → Database → Extensions → pg_cron).
create extension if not exists pg_cron;

-- Vorhandenen Job (bei erneutem Ausführen) entfernen, dann neu planen → idempotent.
select cron.unschedule('prune-app-events') from cron.job where jobname = 'prune-app-events';

-- Täglich um 03:00 UTC alle Events älter als 180 Tage löschen.
select cron.schedule(
  'prune-app-events',
  '0 3 * * *',
  $$delete from public.app_events where occurred_at < now() - interval '180 days'$$
);
