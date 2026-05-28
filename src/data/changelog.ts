import { version as CURRENT_VERSION } from '../../package.json'

export interface ChangelogEntry {
  version: string
  date: string
  changes: { type: 'feat' | 'fix' | 'improve'; text: string }[]
}

/**
 * Beim Releasen:
 * 1. `npm version patch|minor|major` – bumpt package.json
 * 2. Den CURRENT_CHANGES-Block einfrieren (in HISTORY verschieben)
 * 3. CURRENT_CHANGES leeren für die nächste Version
 */

const CURRENT_CHANGES: ChangelogEntry['changes'] = [
  { type: 'improve', text: 'Beim Seitenwechsel wird automatisch nach oben gescrollt' },
]

const HISTORY: ChangelogEntry[] = [
  {
    version: '0.1.6',
    date: '2026-05-28',
    changes: [
      { type: 'fix', text: 'PWA-Updates auf Chrome Android: autoUpdate-Modus mit controllerchange-Listener – App lädt automatisch neu wenn neue Version aktiv wird' },
      { type: 'fix', text: 'Bottom-Navigation springt nicht mehr beim Tab-Wechsel' },
    ],
  },
  {
    version: '0.1.5',
    date: '2026-05-28',
    changes: [
      { type: 'feat', text: 'Spieler können im Kader als inaktiv markiert werden (z.B. bei Verletzung) – erscheinen dann nicht mehr bei der Spieltag-Planung' },
      { type: 'feat', text: 'Einstellungen: „App neu laden"-Button als manueller Fallback für SW-Updates' },
      { type: 'improve', text: 'Inaktiv-Toggle und Löschen-Button in den Spieler-Editor verschoben' },
      { type: 'fix', text: 'Splash Screen: Titel auf kleinen Mobilgeräten nicht mehr abgeschnitten (responsive Schriftgröße)' },
      { type: 'fix', text: 'Zurück-Button aus Einstellungen-Header entfernt' },
    ],
  },
  {
    version: '0.1.4',
    date: '2026-05-28',
    changes: [
      { type: 'fix', text: 'Update-Banner auf Android PWA jetzt zuverlässig (Service Worker auf prompt-Modus, Polling alle 10 Min)' },
    ],
  },
  {
    version: '0.1.3',
    date: '2026-05-28',
    changes: [
      { type: 'feat', text: 'Neue Spieler-Präferenzen: Kein Starter (E1/E2) und Kein Finisher (letzte Spiele)' },
      { type: 'feat', text: 'Aufstellung teilen via Web Share API (WhatsApp, Telegram, …) oder Zwischenablage' },
      { type: 'feat', text: 'Onboarding-Guide für neue Nutzer (6 Slides), jederzeit neu startbar' },
      { type: 'feat', text: 'Changelog als eigene Seite in den Einstellungen' },
      { type: 'feat', text: 'Home-Tab in der Bottom-Navigation' },
      { type: 'feat', text: 'Spieler-Pills in der Aufstellung in individuellen Farben pro Spieler' },
      { type: 'improve', text: 'Gleichverteilungs-Algorithmus zählt jetzt Sätze statt Spiele – dominiert alle Präferenzen' },
      { type: 'improve', text: 'Einheitliches Seiten-Layout: Header-Abstände, Content-Spacing und Glow-Positionen' },
      { type: 'fix', text: 'Satz-Zähler aktualisiert sich sofort nach Drag & Drop' },
      { type: 'fix', text: 'Clipboard-Fallback für non-HTTPS Umgebungen beim Teilen' },
    ],
  },
  {
    version: '0.1.2',
    date: '2026-05-28',
    changes: [
      { type: 'improve', text: 'Spieler-Editor komplett überarbeitet: 5-stufige Präferenz-Skala, Toggle-Switch für Goalie, tippbare Partner-Pills' },
      { type: 'improve', text: 'Abschnitte: „Bevorzugte Position", „Bevorzugter Spieltyp", „Bevorzugte Partner"' },
    ],
  },
  {
    version: '0.1.1',
    date: '2026-05-28',
    changes: [
      { type: 'feat', text: 'Schema-Versionierung: automatische Datenmigration beim App-Start' },
      { type: 'feat', text: 'PWA Update-Banner bei neuer App-Version' },
      { type: 'feat', text: 'App-Version und Datenformat-Version sichtbar in den Einstellungen' },
      { type: 'feat', text: 'Neues App-Icon: Twemoji-Einhorn auf dunklem Violett-Hintergrund' },
      { type: 'improve', text: 'Algorithmus: Ratio-basierte Penalty verhindert Dominanz einzelner Spieler' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-28',
    changes: [
      { type: 'feat', text: 'Spielerverwaltung mit dauerhaften Präferenzen (Position, Spieltyp, Goalie, Partner)' },
      { type: 'feat', text: 'Spieltag-Planung mit Verfügbarkeit, Gegner, Datum, Goalie-Modus, 5. Doppel' },
      { type: 'feat', text: 'Automatische Aufstellung nach Hamburger Liga-Regeln' },
      { type: 'feat', text: 'Drag & Drop, Slot-Editor, Regelverstoß-Erkennung, Kampflos-Markierung' },
      { type: 'feat', text: 'Export & Import (JSON), Spieler sortierbar' },
      { type: 'feat', text: 'PWA: installierbar auf iOS & Android, offline-fähig' },
      { type: 'feat', text: 'Deploy auf GitHub Pages via GitHub Actions' },
    ],
  },
]

// Datum des aktuellen Releases – beim `npm version`-Bump auf das Datum setzen
const CURRENT_DATE = '2026-05-28'

export const CHANGELOG: ChangelogEntry[] = [
  ...(CURRENT_CHANGES.length > 0 ? [{
    version: CURRENT_VERSION,
    date: CURRENT_DATE,
    changes: CURRENT_CHANGES,
  }] : []),
  ...HISTORY,
]

export const TYPE_LABEL: Record<ChangelogEntry['changes'][0]['type'], string> = {
  feat:    'Neu',
  fix:     'Fix',
  improve: 'Verbessert',
}

export const TYPE_COLOR: Record<ChangelogEntry['changes'][0]['type'], string> = {
  feat:    'bg-unicorn-cyan/15 text-unicorn-cyan',
  fix:     'bg-amber-500/15 text-amber-300',
  improve: 'bg-unicorn-pink/15 text-unicorn-pink',
}
