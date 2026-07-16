# E-Mail-Templates (Supabase Auth)

`magic-link.html` ist die Hornstrike-Vorlage. Einzufügen im Dashboard unter
**Authentication → Email Templates**.

## Wichtig: Supabase nutzt beim OTP-Login ZWEI Templates

`signInWithOtp` wählt je nach Nutzer ein anderes Template:

- **neuer Nutzer** (E-Mail noch nicht registriert) → **„Confirm signup"**
- **bestehender Nutzer** → **„Magic Link"**

Wird nur „Magic Link" angepasst, bekommen **neue** Nutzer weiterhin die
Standard-Mail *„Confirm your email address"* (nur Link, **kein Code**, ohne
Branding). Deshalb `magic-link.html` in **BEIDE** Templates einfügen:

| Dashboard-Template | Body | Subject-Vorschlag |
|---|---|---|
| **Confirm signup** | Inhalt von `magic-link.html` | `Dein Hornstrike Login-Code: {{ .Token }}` |
| **Magic Link**     | Inhalt von `magic-link.html` | `Dein Hornstrike Login-Code: {{ .Token }}` |

## Warum das funktioniert

`magic-link.html` enthält beides:
- `{{ .Token }}` → der **6-stellige Code**, den man in der App eingibt
  (die App verifiziert per `verifyOtp(..., { type: 'email' })`).
- `{{ .ConfirmationURL }}` → klickbarer **Link** als Alternative.

## Pflicht beim Einfügen

- Im Footer den Platzhalter `[Betreiber-Name] · [Straße Hausnr.] · [PLZ Ort]` mit
  echten Angaben füllen – **Anbieterkennzeichnung**/Pflichtangabe für
  geschäftsmäßige E-Mails. Direkt im Dashboard eintragen, **nicht** ins Repo committen.
- Die Impressum-/Datenschutz-Links im Footer zeigen auf `https://hornstrike.de/#/…`.
  Bei anderer Domain dort anpassen.

## Optional

- Betreff auch für „Magic Link"/„Confirm signup" auf den Vorschlag oben setzen.
- Redirect-URL-Allowlist (Authentication → URL Configuration) muss die
  Produktions-Domain enthalten, damit der Link-Fallback funktioniert.
