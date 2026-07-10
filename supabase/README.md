# Supabase – Backend für Hornstrike

Alles Backend-seitige liegt hier versioniert, damit es auf Managed-Supabase **und**
später auf einem selbstgehosteten Supabase-in-Docker identisch läuft.

```
supabase/
  migrations/   Postgres-Schema, RLS, RPCs (nummeriert, einmal ausführen)
  README.md     dieses Dokument
```

## Migration anwenden

Solange wir die Supabase-CLI noch nicht verdrahtet haben, am einfachsten über den
**SQL-Editor** im Dashboard:

1. Dashboard → **SQL Editor** → **New query**.
2. Inhalt von `migrations/0001_init.sql` komplett hineinkopieren → **Run**.
3. Bei Erfolg: „Success. No rows returned."

Die Migration ist **nicht idempotent** (`create type/table`) – pro Datenbank genau
einmal ausführen. Für einen sauberen Neuanfang vorher das `public`-Schema leeren.

## Plattform-Admin einmalig setzen

Nach dem ersten OTP-Login existiert dein Profil mit `is_platform_admin = false`.
Das Flag kann sich niemand selbst setzen (Guard-Trigger). Einmalig im SQL-Editor
(dort läuft man als `postgres`, daher erlaubt):

```sql
update public.profiles set is_platform_admin = true
where email = 'DEINE-LOGIN-MAIL';
```

Damit kannst du Vereins-Anträge (`club_requests`) freigeben.

## E-Mail (Pflicht für OTP-Login)

Auth → SMTP: echten Transaktions-Versender hinterlegen (z. B. **Resend**, Free-Tier,
EU). Ohne eigenen SMTP limitiert Supabase Auth-Mails auf wenige pro Stunde – der
OTP-Login würde real scheitern.

## Sicherheitsmodell (Kurzfassung)

- **Data-API „Automatically expose new tables" = AUS** → Tabellen-Rechte werden in
  der Migration explizit nur an `authenticated` vergeben, nie an `anon`.
- **RLS auf jeder Tabelle**, default-deny. Rollen werden über `SECURITY DEFINER`-
  Helfer im `app`-Schema aufgelöst (verhindert Policy-Rekursion).
- `service_role`-Key **niemals** ins Frontend/Repo – nur lokal fürs Seed-Skript.

## Nächste Migrationen (geplant)

- `0002_*` – Terminfindung (polls/poll_options/poll_responses) in Phase 3.
