-- ============================================================================
-- Phase 9a: Neue Rolle „co_captain" – NUR der Enum-Wert.
--   WICHTIG: getrennt von 0010 ausführen! Postgres erlaubt die Verwendung eines
--   neu hinzugefügten Enum-Werts erst NACH dem Commit der Transaktion. Also:
--   erst diese Datei ausführen, DANN 0010.
-- ============================================================================
alter type public.role_type add value if not exists 'co_captain';
