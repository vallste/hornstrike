# Rollen & Rechte (Hornstrike)

Stand: nach Migration `0012_role_guard_locking.sql`.

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
| Eigene Verfügbarkeit in Umfrage angeben | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kader bearbeiten (Spieler anlegen/ändern/sortieren) | – | ✓ | ✓ | ✓ | ✓ |
| Spieltag anlegen + Aufstellung berechnen/bearbeiten | – | ✓ | ✓ | ✓ | ✓ |
| Umfrage anlegen/verwalten + „Aufstellung erstellen" | – | ✓ | ✓ | ✓ | ✓ |
| Verfügbarkeiten/Umfrageantworten **anderer** pflegen | – | ✓ | ✓ | ✓ | ✓ |
| Mitglieder einladen (Einladungslinks) | – | – | ✓ | ✓ | ✓ |
| **Rollen zuweisen** (Captain/Co-Captain/Spieler) | – | – | ✓ (eigenes Team) | ✓ (Teams des Vereins) | ✓ (überall) |
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
| `team:editRoster`, `team:editLineup`, `team:createMatchday`, `team:managePolls` | Co-Captain |
| `team:invite`, `team:manageRoles` | Captain |
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
