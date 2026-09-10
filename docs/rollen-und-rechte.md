# Rollen & Rechte (Hornstrike)

Stand: nach Migration `0015_liga_ids.sql`.

## Rollen

| Rolle | Beschreibung |
|---|---|
| **Plattform-Admin** | Betreiber der Plattform. Sieht/verwaltet alles über alle Vereine hinweg (Statistiken, Vereins-Anträge). Technisch `profiles.is_platform_admin = true`. |
| **Vereins-Admin** (`club_admin`) | Verwaltet einen Verein: Teams anlegen/umbenennen, Verein umbenennen, Rollen in den Teams des Vereins vergeben. |
| **Captain** (`team_admin`) | Leitet ein Team: Kader/Spieltage/Umfragen/Aufstellungen, Mitglieder einladen, Rollen im eigenen Team vergeben. |
| **Co-Captain** (`co_captain`) | Wie Captain bei den **Inhalten** (Kader, Spieltage, Umfragen, Aufstellungen, Verfügbarkeiten) – **aber ohne** Einladen und **ohne** Rollenvergabe. |
| **Spieler** (`player`) | Sieht alles im Team read-only; bearbeitet nur das **eigene** Profil/Präferenzen und die **eigene** Verfügbarkeit; beantwortet Umfragen. |

Hierarchie ist **nicht** rein linear: Co-Captain hat Inhalts-Rechte wie ein Captain, aber nicht dessen Verwaltungs-Rechte. Deshalb explizite Rechte-Matrix statt Rangfolge.

## Rechte-Matrix (Funktion × Rolle)

| Funktion | Spieler | Co-Captain | Captain | Vereins-Admin | Plattform-Admin |
|---|:--:|:--:|:--:|:--:|:--:|
| Listen ansehen (Spieler/Spieltage/Umfragen) | 👁 | 👁 | 👁 | 👁 | 👁 |
| Eigenes Profil/Präferenzen bearbeiten | ✓ | ✓ | ✓ | ✓ | ✓ |
| Eigenes Profilbild setzen/entfernen | ✓ | ✓ | ✓ | ✓ | ✓ |
| Eigene Liga-ID hinterlegen | ✓ | ✓ | ✓ | ✓ | ✓ |
| Eigene Verfügbarkeit in Umfrage angeben | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kader bearbeiten (Spieler anlegen/ändern/sortieren) | – | ✓ | ✓ | ✓ | ✓ |
| Profilbild **anderer** Spieler setzen/entfernen | – | ✓ | ✓ | ✓ | ✓ |
| Liga-ID **anderer** Spieler hinterlegen | – | ✓ | ✓ | ✓ | ✓ |
| Spieltag anlegen + Aufstellung berechnen/bearbeiten | – | ✓ | ✓ | ✓ | ✓ |
| Aufstellung sperren/entsperren | – | ✓ | ✓ | ✓ | ✓ |
| Umfrage anlegen/verwalten + „Aufstellung erstellen" | – | ✓ | ✓ | ✓ | ✓ |
| Verfügbarkeiten/Umfrageantworten **anderer** pflegen | – | ✓ | ✓ | ✓ | ✓ |
| Mitglieder einladen (Einladungslinks) | – | – | ✓ | ✓ | ✓ |
| **Rollen zuweisen** (Captain/Co-Captain/Spieler) | – | – | ✓ (eigenes Team) | ✓ (Teams des Vereins) | ✓ (überall) |
| Team-Logo setzen/entfernen | – | – | ✓ | ✓ | ✓ |
| Liga-ID des Teams hinterlegen | – | ✓ | ✓ | ✓ | ✓ |
| Vereinslogo setzen/entfernen | – | – | – | ✓ | ✓ |
| Teams anlegen/umbenennen, Verein umbenennen, Workspace wechseln | – | – | – | ✓ | ✓ |
| **Vereins-Admins** ernennen/entfernen | – | – | – | ✓ (eigener Verein) | ✓ (überall) |
| „Verein"-Tab im Footer | – | – | – | ✓ | ✓ |
| Statistiken + Vereins-Anträge (Plattform-Admin-Karte) | – | – | – | – | ✓ |
| Neuen Verein beantragen | ✓ | ✓ | ✓ | ✓ | ✓ |

👁 = nur ansehen · ✓ = darf bearbeiten · – = kein Zugriff

## Rollenvergabe

### Team-Rollen (Captain / Co-Captain / Spieler)
- **Wer darf vergeben:** Plattform-Admin (überall), Vereins-Admin (Teams seines Vereins), Captain (eigenes Team).
- **Captain-Wechsel:** Ein Captain darf andere zu Captain machen oder herabstufen. **Mehrere Captains** gleichzeitig sind erlaubt.
- **Letzter-Captain-Schutz:** Der **einzige** verbleibende Captain eines Teams kann nicht herabgestuft/entfernt werden (serverseitig erzwungen → Fehlermeldung „cannot remove the last captain of the team").
- **UI:** Einstellungen → **Mitglieder & Einladungen** → bei jedem Mitglied mit Account öffnet die aktuelle Rolle ein Dropdown (nur sichtbar für Captain+). Das Dropdown ist ein eigenes Button-Menü (kein natives `<select>`), damit es auf allen Mobilgeräten öffnet.

### Vereins-Admin (`club_admin`)
- **Entsteht** entweder über die **Vereins-Antrag-Freigabe** (der Antragsteller wird automatisch erster Vereins-Admin) **oder** wird über die **Vereine-&-Teams-Seite** vergeben.
- **Wer darf vergeben:** Plattform-Admin (überall) und **bestehende Vereins-Admins** des Vereins → **Mehrere Vereins-Admins** und Übergabe möglich (analog zur Captain-Regel).
- **Letzter-Vereins-Admin-Schutz:** Der **einzige** verbleibende Vereins-Admin kann nicht entfernt werden (serverseitig → „cannot remove the last admin of the club").
- **UI:** Footer **Verein** → je Verein Abschnitt **„Vereins-Admins"** (aufklappbar). Mitglieder-Liste kommt aus der SECURITY-DEFINER-RPC `club_members` (nötig, weil `profiles`-RLS sonst nur das eigene Profil zeigt).

### Onboarding ohne Team
- Ein frisch freigegebener Vereins-Admin hat einen Verein, aber noch **kein Team**. Er wird auf die **Vereine-&-Teams-Seite** geleitet (nicht in die „Verein beantragen"-Sackgasse) und legt dort sein erstes Team an. Status intern: `useTeamStatus() === 'club-only'`.

## Wo wird das durchgesetzt?

Zwei Ebenen – die UI spiegelt nur, die **echte Absicherung ist die Datenbank (RLS)**.

**UI/Client** (`src/lib/permissions.ts`): Capability-Matrix `CAPS` + `can(role, cap)` / `useCan(cap)` / `<Can cap>`. Capabilities:

| Capability | ab Rolle |
|---|---|
| `player:editOwnPrefs` | Spieler |
| `team:editRoster`, `team:editLineup`, `team:createMatchday`, `team:managePolls`, `team:editLigaId` | Co-Captain |
| `team:invite`, `team:manageRoles`, `team:editLogo` | Captain |
| `club:manageTeams`, `club:invite` | Vereins-Admin |
| `app:manageClubs`, `app:viewStats` | Plattform-Admin |

**Server/RLS** (`supabase/migrations/0001_init.sql`, `0010_role_management.sql`) über `SECURITY DEFINER`-Helfer im Schema `app`:

| Helfer | bedeutet |
|---|---|
| `app.is_platform_admin()` | Plattform-Admin |
| `app.is_club_admin(club)` | Vereins-Admin des Vereins (oder Plattform-Admin) |
| `app.is_team_admin(team)` | Captain des Teams (bzw. Vereins-/Plattform-Admin) |
| `app.is_team_editor(team)` | Captain **oder** Co-Captain → **Inhaltsbearbeitung** |
| `app.is_team_member(team)` | irgendeine Rolle im Team → **Lesen** |
| `app.can_edit_player(player)` | `is_team_editor` des Spieler-Teams **oder** eigener Account |
| `app.can_read_avatar(name)` / `app.can_write_avatar(name)` | Storage-RLS für Profilbilder, löst den Objektpfad auf die Entität auf (`0013`) |

- **Lesen** (`_select`-Policies): `is_team_member`.
- **Inhalte schreiben** (players, matchdays, polls, poll_options, sowie Präferenzen/Verfügbarkeiten/Umfrageantworten via `can_edit_player`): `is_team_editor` → Captain + Co-Captain.
- **Einladungen** (`invites`): `is_team_admin` → nur Captain+.
- **Rollen/Mitgliedschaften**: kein direkter Client-Schreibzugriff. Änderungen ausschließlich über `SECURITY DEFINER`-RPCs:
  - `public.set_member_role(user, team, role)` / `public.remove_member(user, team)` – Team-Rollen, mit Letzter-Captain-Schutz (`0010`).
  - `public.set_club_admin(user, club, make)` – Vereins-Admin setzen/entfernen, mit Letzter-Vereins-Admin-Schutz (`0011`).
  - `public.club_members(club)` – Leseliste der Vereinsmitglieder für die Rollen-UI (`0011`).
  - `redeem_invite` / `approve_club_request` – Beitritt bzw. erster Vereins-Admin.
  - Die „Letzter-Admin/Captain"-Prüfungen sind pro Verein/Team über einen transaktionsgebundenen Advisory-Lock serialisiert (`0012`), damit zwei parallele Entfernungen nicht beide am Schutz vorbeikommen.

## Vorschau-Modus (nur Ansicht)

Captain+ können in den Einstellungen „als Spieler" in die Vorschau wechseln (rein clientseitig, `PreviewRoleProvider`). Das ändert **keine** echten Rechte – die Datenbank prüft immer die tatsächliche Rolle.

## Profilbilder (Migration `0013`)

Bilder liegen in einem **privaten** Storage-Bucket `avatars`, nicht öffentlich abrufbar. In der Datenbank steht ausschließlich der Pfad (`clubs.avatar_path`, `teams.avatar_path`, `players.avatar_path`), nie eine URL – die Anzeige läuft über kurzlebige signierte URLs (`src/lib/avatars.ts`).

Objektname = `players/<uuid>` | `teams/<uuid>` | `clubs/<uuid>`, bewusst **ohne** Dateiendung: pro Entität genau eine Datei, ein neues Bild überschreibt das alte. Der Bucket lässt nur `image/jpeg`, `image/png`, `image/webp` und maximal 2 MB zu; der Client schneidet vorher quadratisch zu, skaliert auf 512 px und kodiert neu (auch damit HEIC von iPhones in ein erlaubtes Format übersetzt wird).

| Objekt | Lesen | Schreiben |
|---|---|---|
| `players/<id>` | Mitglied des Teams | `can_edit_player` → man selbst, Captain, Co-Captain |
| `teams/<id>` | Mitglied des Teams | `is_team_admin` → Captain+ |
| `clubs/<id>` | Mitglied irgendeines Team des Vereins, oder Vereins-Admin | `is_club_admin` → Vereins-Admin+ |

`teams.avatar_path` ist per Tabellen-Policy nur für Vereins-Admins schreibbar (`teams_update`). Damit ein Captain sein Team-Logo setzen kann, ohne gleich das Umbenennen-Recht zu bekommen, gibt es den RPC `public.set_team_avatar(team, path)` – er prüft `is_team_admin` und schreibt ausschließlich die Logo-Spalte. Im Client hängt die UI an der Capability `team:editLogo`; weil der Footer-Tab „Verein" nur Admins sehen, liegt das Team-Logo für Captains in den Einstellungen unter „Verein".

## Aufstellung sperren (Migration `0014`)

`matchdays.lineup_locked` markiert eine Aufstellung als final. In der UI schaltet das Drag&Drop, die Slot-Bearbeitung, „Neu berechnen" und den Sprung in den Spieltag-Editor ab; sichtbar bleibt alles, Teilen funktioniert weiter.

Sperren und Entsperren hängt an keiner eigenen Policy: die bestehende `md_update`-Policy verlangt `app.is_team_editor`, also **Captain und Co-Captain**. In der UI hängt der Knopf an der Capability `team:editLineup` – dieselbe Rollenmenge.

Der Schutz liegt zusätzlich in der Datenbank. Der Trigger `matchdays_guard_locked_lineup` weist jedes Update ab, das `lineup` verändert, während die Sperre steht (`raise exception 'lineup is locked'`, im Client übersetzt in `src/lib/errors.ts`). Maßgeblich ist der Zustand **vor** dem Update: entsperren und überschreiben in einem einzigen Update wird abgelehnt, es braucht zwei Schritte. Datum, Gegner, Ort, Notizen und Verfügbarkeiten bleiben auch bei gesperrter Aufstellung änderbar – verglichen wird ausschließlich die Spalte `lineup`.

Bei gesperrter Aufstellung hält die App über die Screen Wake Lock API zusätzlich den Bildschirm wach (`src/lib/useWakeLock.ts`), solange die Seite im Vordergrund ist.

## Liga-Verknüpfung (Migration `0015`)

`players.liga_player_id` und `teams.liga_team_id` verweisen auf die öffentlichen Seiten des Tischfußballverbands Hamburg. Gespeichert wird **nur die Zahl**; die Adresse baut der Client aus einer festen Basis (`src/lib/liga.ts`). Über das Feld lässt sich also keine fremde Adresse in die App bringen, und ein Pfadwechsel beim Verband kostet eine Zeile im Frontend statt einer Datenwanderung. Die Eingabe akzeptiert die komplette URL und zieht die ID heraus.

Die App **ruft dort nichts ab**. Ein Import der Ansetzungen scheiterte an zwei Punkten: die Seite beantwortet Nicht-Browser-Anfragen mit `410 Gone` (auch die `robots.txt`), und CORS-Header liefert sie ohnehin keine – ein Abruf aus dem Browser heraus wäre unmöglich, ein serverseitiger nur durch Umgehen der Sperre.

| Feld | Schreibrecht | Weg |
|---|---|---|
| `players.liga_player_id` | man selbst, Captain, Co-Captain | direkt (`players_update` deckt das ab) |
| `teams.liga_team_id` | Captain, Co-Captain | RPC `public.set_team_liga_id` (prüft `is_team_editor`) |

Achtung, bewusste Asymmetrie: das **Team-Logo** verlangt serverseitig `is_team_admin` (Captain+, ohne Co-Captain), die **Liga-ID** dagegen `is_team_editor` (mit Co-Captain). Wer das angleichen will, ändert den Guard im jeweiligen RPC und die Capability-Zuordnung.
