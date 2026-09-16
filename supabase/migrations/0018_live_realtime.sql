-- ============================================================================
-- Phase 15: Live-Ergebnisse kommen sofort an, statt im 30-Sekunden-Takt.
--   NACH 0017 ausführen. Einmalig im Supabase-SQL-Editor.
--
--   Die Terminumfragen hängen seit 0003 in der Realtime-Publikation und
--   aktualisieren sich ohne Zutun. Ausgerechnet die Ergebnis-Erfassung – die
--   eine Stelle, an der Sekunden zählen – hat bisher gepollt. Das holen wir
--   hier nach.
--
--   ZUR REPLICA IDENTITY, bewusst NICHT angefasst:
--   Für gelöschte Zeilen liefert Postgres nur die Spalten der Replica Identity,
--   standardmäßig also den Primärschlüssel. Bei matchday_sets und
--   matchday_opponents steckt matchday_id im Schlüssel – deren DELETEs lassen
--   sich also serverseitig filtern. Bei matchday_events ist der Schlüssel nur
--   die id, ein DELETE trägt die matchday_id folglich nicht mit.
--
--   Naheliegend wäre `replica identity full`. Das wäre hier aber ein Leck:
--   Supabase wendet auf DELETE-Ereignisse keine RLS an, die vollständige alte
--   Zeile ginge also an alle Abonnenten der Tabelle – auch aus fremden Teams.
--   Mit dem Standard wird stattdessen nur eine nackte UUID verschickt, die
--   nichts verrät. Der Client gleicht Rücknahmen darüber ab, dass sich der
--   Satzstand mitändert (matchday_sets), und hört zusätzlich ungefiltert auf
--   DELETE – die UUID genügt ihm als Anlass zum Nachladen.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['matchday_sets', 'matchday_events', 'matchday_opponents', 'matchdays']
  loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Kontrolle: sollte die vier Tabellen oben plus polls/poll_responses aus 0003 zeigen.
-- select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
