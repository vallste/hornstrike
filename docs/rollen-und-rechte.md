# Rollen & Rechte (Hornstrike)

Stand: nach Migration `0010_role_management.sql`.

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
| „Verein"-Tab im Footer | – | – | – | ✓ | ✓ |
| Statistiken + Vereins-Anträge (Plattform-Admin-Karte) | – | – | – | – | ✓ |
| Neuen Verein beantragen | ✓ | ✓ | ✓ | ✓ | ✓ |

👁 = nur ansehen · ✓ = darf bearbeiten · – = kein Zugriff

## Rollenvergabe

- **Wer darf vergeben:** Plattform-Admin (überall), Vereins-Admin (Teams seines Vereins), Captain (eigenes Team).
- **Vergebbare Team-Rollen:** Captain, Co-Captain, Spieler. (Vereins-Admin wird **nicht** über diese Funktion vergeben – entsteht über die Vereins-Antrag-Freigabe bzw. Plattform-Admin.)
- **Captain-Wechsel:** Ein Captain darf andere zu Captain machen oder herabstufen. **Mehrere Captains** gleichzeitig sind erlaubt.
- **Letzter-Captain-Schutz:** Der **einzige** verbleibende Captain eines Teams kann nicht herabgestuft/entfernt werden (serverseitig erzwungen → Fehlermeldung „cannot remove the last captain of the team").
- **UI:** Einstellungen → **Mitglieder & Einladungen** → bei jedem Mitglied mit Account öffnet die aktuelle Rolle ein Dropdown (nur sichtbar für Captain+).

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
- **Rollen/Mitgliedschaften**: kein direkter Client-Schreibzugriff. Änderungen ausschließlich über `SECURITY DEFINER`-RPCs `public.set_member_role(user, team, role)` und `public.remove_member(user, team)` (mit Autorisierungs-Check + Letzter-Captain-Schutz) sowie `redeem_invite` / `approve_club_request`.

## Vorschau-Modus (nur Ansicht)

Captain+ können in den Einstellungen „als Spieler" in die Vorschau wechseln (rein clientseitig, `PreviewRoleProvider`). Das ändert **keine** echten Rechte – die Datenbank prüft immer die tatsächliche Rolle.
