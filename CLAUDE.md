# Hornstrike – Fellow Unicorns Lineup Planner

PWA für das Tischfussball-Team **Fellow Unicorns** zur Spieltag-Aufstellungsplanung in der **Hamburger Liga** (Liga 2/3/4).

## Stack

- React 18 + TypeScript + Vite + Tailwind CSS
- Framer Motion (Splash-Animation)
- vite-plugin-pwa + Workbox (Service Worker, offline-fähig)
- localStorage (kein Backend)

## Design

- Dark Mode, Unicorn-Palette: `#1a0533` (Hintergrund), `#4a0e8f` (Violet), `#e040fb` (Pink), `#00e5ff` (Cyan), `#ffd700` (Gold)
- Font: Outfit (Google Fonts)
- Splash-Animation: Einhorn galoppiert über Kickertisch, schießt Ball ins Tor, Konfetti, dann „Hornstrike"-Schriftzug

## Hamburger Liga – Spielregeln

**Spielfolge (12 Spiele):**
```
E1 → E2 → D1 → E3 → E4 → D2 → E5 → E6 → D3 → E7 → E8 → D4
```

**Kernregeln für den Algorithmus:**
- Max. **2 Einzel** + **2 Doppel** pro Spieler pro Begegnung
- Dasselbe Doppel-Pärchen darf nur **einmal** aufgestellt werden
- **E5 und E6** können als **Torwarteinzel** ausgewiesen werden (Liga 2/3/4)
- Bei weniger Spielern: reduzierte Spielzahl (3 Spieler → 9 Spiele, 2 Spieler → 5 Spiele)

## Datenmodell (src/types/index.ts)

Zwei Ebenen von Präferenzen:

| Ebene | Wo gespeichert | Felder |
|-------|---------------|--------|
| **Dauerpräferenzen** | Player-Profil (localStorage) | Position, Einzel/Doppel-Vorliebe, Goalie, Partnerwünsche |
| **Spieltag-Präferenzen** | MatchDay-Objekt | `availableFrom`, `availableTo` (ab/bis Spiel X) |

## App-Screens

1. **Splash Screen** – Framer Motion Einhorn-Animation (~2–3 Sek.)
2. **Home / Dashboard** – Navigation
3. **Spieler-Verwaltung** – Liste + CRUD
4. **Spieler-Editor** – alle Dauerpräferenzen setzen
5. **Spieltag-Setup** – Datum, aktive Spieler auswählen + Spieltag-Präferenzen
6. **Aufstellung** – berechnetes Lineup, manuell anpassbar, Neuberechnung möglich
7. **Lineup-Detail** – einzelne Spielzuweisung editieren

## Algorithmus (src/utils/lineup.ts – noch zu erstellen)

Constraint Satisfaction + Greedy Scoring:
1. Spiele in Reihenfolge durchgehen
2. Valide Spielerzuweisungen ermitteln (Constraints: Spiellimit, Doppel-Einzigartigkeit, Verfügbarkeit)
3. Score pro Zuweisung: Positionspräferenz (+10), Einzel/Doppel-Präferenz (+8), Partner-Match (+5×Gewicht), Goalie (+3)
4. Greedy-Auswahl mit Backtracking bei Sackgassen

## Entwicklung

```bash
npm run dev      # Vite Dev Server auf Port 5173
npm run build    # Produktions-Build
npm run preview  # Build lokal testen
```

## PWA

- Manifest in `vite.config.ts` konfiguriert
- Icons unter `public/icons/` (192×192 und 512×512 PNG)
- iOS: apple-touch-icon + Meta-Tags in `index.html`
