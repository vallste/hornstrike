-- ============================================================================
-- Phase 11: Aufstellung sperren ("steht fest").
--   NACH 0013 ausführen. Einmalig im Supabase-SQL-Editor.
--
--   - matchdays.lineup_locked: gesperrt = die Aufstellung ist final. In der UI
--     sind dann Drag&Drop, Slot-Bearbeitung und Neu-Berechnen abgeschaltet.
--   - Sperren/Entsperren darf, wer die Aufstellung ohnehin bearbeiten darf:
--     die md_update-Policy verlangt app.is_team_editor → Captain UND Co-Captain.
--     Dafür braucht es keine neue Policy, nur die neue Spalte.
--   - Der Schutz liegt bewusst NICHT nur in der UI. Ein Trigger weist Änderungen
--     an `lineup` ab, solange die Sperre steht – so kann auch ein Tab, der die
--     Sperre noch nicht mitbekommen hat, die Aufstellung nicht überschreiben.
-- ============================================================================

alter table public.matchdays add column if not exists lineup_locked boolean not null default false;

-- Maßgeblich ist der Zustand VOR dem Update (old.lineup_locked). Wer die
-- Aufstellung ändern will, muss also erst entsperren und dann ändern; ein
-- kombiniertes „entsperren + überschreiben" in einem einzigen Update wird
-- abgewiesen. Das ist Absicht: so bleibt die Regel in einem Satz erklärbar.
--
-- Verglichen wird ausschließlich die Spalte `lineup` – Datum, Gegner, Ort,
-- Notizen und Verfügbarkeiten bleiben auch bei gesperrter Aufstellung änderbar.
-- Der Client schickt beim Speichern immer die ganze Zeile mit; weil jsonb
-- inhaltlich (nicht textuell) verglichen wird, stört das unveränderte Mitsenden
-- der Aufstellung nicht.
create or replace function public.matchdays_guard_locked_lineup() returns trigger
language plpgsql set search_path = public, app as $$
begin
  if old.lineup_locked and new.lineup is distinct from old.lineup then
    raise exception 'lineup is locked';
  end if;
  return new;
end $$;

drop trigger if exists matchdays_guard_locked_lineup on public.matchdays;
create trigger matchdays_guard_locked_lineup before update on public.matchdays
  for each row execute function public.matchdays_guard_locked_lineup();
