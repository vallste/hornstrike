import { version as CURRENT_VERSION } from '../../package.json'

export interface ChangelogEntry {
  version: string
  date: string
  changes: { type: 'feat' | 'fix' | 'improve'; text: string }[]
}

/**
 * Beim Releasen:
 * 1. CURRENT_CHANGES-Block einfrieren: mit der aktuellen package.json-Version
 *    und dem Release-Datum nach HISTORY verschieben
 * 2. CURRENT_CHANGES leeren
 * 3. Commit mit der Version als Nachricht (`26.3.3`) + annotiertes Tag `v26.3.3`
 *
 * Und dann die Stelle, an der man sich leicht vertut:
 * 4. `npm version patch|minor|major` erst DANN, wenn der erste neue Eintrag in
 *    CURRENT_CHANGES geschrieben wird – **vor** diesem Eintrag, nicht direkt
 *    beim Release.
 *
 * Warum nicht sofort bumpen: Die App wird bei jedem Push ausgeliefert, die
 * package.json-Version ist also immer die live laufende. Bumpt man direkt beim
 * Release, zeigen die Einstellungen „v26.3.4 · 7 neue Einträge" für Einträge,
 * die zu 26.3.3 gehören. Warum nicht später bumpen: Steht die neue Version noch
 * nicht, wenn der erste Eintrag kommt, erscheint dieselbe Version zweimal im
 * Changelog – einmal aus HISTORY, einmal aus CURRENT_CHANGES.
 *
 * CURRENT_DATE ist das voraussichtliche Datum des laufenden Releases.
 */

const CURRENT_CHANGES: ChangelogEntry['changes'] = [
  { type: 'fix', text: 'Geht eine Begegnung nicht glatt auf – fünf Personen teilen sich 24 Sätze nun einmal ungleich –, wandert die Mehrlast jetzt bei jedem „Neu berechnen" zu jemand anderem. Vorher landete sie fast immer bei derselben Person, weil die Präferenzen schwerer wogen als der Zufall. An der Verteilung selbst ändert das nichts: 4/4/5/5/6 bleibt bei fünf Personen das rechnerische Optimum, nur die Besetzung wechselt' },
  { type: 'improve', text: 'Neu berechnen, Verschieben per Drag & Drop und Sperren einer Aufstellung brauchen jetzt zwei statt vier Server-Anfragen. Bisher wurden dabei jedes Mal die Verfügbarkeiten gelöscht und unverändert neu geschrieben – das kostete nicht nur Zeit: bricht die Verbindung genau dazwischen ab, waren sie weg' },
  { type: 'feat', text: 'Live-Erfassung ohne Netz: Getippte Tore liegen jetzt in einer Warteschlange auf dem Gerät und gehen raus, sobald die Verbindung zurück ist – auch wenn du die App zwischendurch schließt. Oben steht jederzeit, wie viele Eingaben noch nicht gespeichert sind; einzelne Zeilen im Protokoll sind bis dahin mit einem Punkt markiert' },
  { type: 'fix', text: 'Tippen zwei Leute gleichzeitig dasselbe Tor mit, zählt es nur noch einmal. Dasselbe gilt, wenn eine Eingabe nach einem Verbindungsabbruch erneut gesendet wird. Wird eine Eingabe deshalb verworfen, sagt die App es – statt still einen falschen Stand stehen zu lassen' },
  { type: 'improve', text: 'Erfassen zwei Leute gemeinsam, erscheinen die Eingaben der anderen Seite jetzt sofort statt erst nach bis zu 30 Sekunden – dieselbe Technik, mit der sich die Terminumfragen schon von selbst aktualisieren. Fällt die Verbindung aus, gleicht die App weiter im Hintergrund ab' },
  { type: 'feat', text: 'Zwischen zwei Sätzen zeigt die Live-Erfassung jetzt einen Zwischenschirm: das Ergebnis des Satzes davor, wer als Nächstes am Tisch steht und auf welcher Position – und einen großen „Go“-Knopf, der den Satz anpfeift' },
  { type: 'feat', text: 'Die Dauer eines Satzes wird mitgeschrieben: „Go“ setzt den Anpfiff, das entscheidende Tor den Abpfiff. In der Satzliste steht sie neben den Satzpunkten. Der Zeitpunkt jedes Tores kommt jetzt vom Gerät statt vom Server – sonst wäre eine Eingabe aus dem Funkloch Minuten zu spät vermerkt' },
  { type: 'improve', text: 'Die Tor-Knöpfe sind neu geordnet: zwei Bereiche, „Wir“ und „Gegner“, mit jeweils denselben fünf Eingaben – Tor der beiden Spielenden, Eigentor der anderen Seite, Timeout, Positionswechsel. Eigentore, Timeouts und Wechsel lagen vorher verstreut dazwischen' },
  { type: 'fix', text: 'Uhrzeit und Ort lassen sich jetzt auch beim Bearbeiten eines Spieltags sehen und ändern. Bisher kamen sie nur aus der Terminfindung und waren danach unsichtbar – der Spieltag trug sie still mit sich herum' },
  { type: 'feat', text: 'Über das 📊 neben der Spieler:innen-Auswahl (und in der Aufstellung neben „Sätze pro Spieler:in“) zeigt die App, wer über die Saison wie viel gespielt hat – wer am wenigsten dran war, steht oben. Wahlweise für die laufende Saison, insgesamt oder ab einem Datum' },
]

const HISTORY: ChangelogEntry[] = [
  {
    version: '26.3.4',
    date: '2026-09-16',
    changes: [
      { type: 'feat', text: 'Ergebnisse erfassen: Jeder Spieltag hat jetzt eine Ergebnis-Ansicht mit allen 16 Sätzen. Du kannst nur den Endstand eines Satzes eintippen – oder im Live-Modus Tor für Tor mitschreiben, mit einem Tipp pro Tor. Wer aus welcher Position getroffen hat, weiß die App aus der Aufstellung' },
      { type: 'feat', text: 'Im Live-Modus lassen sich außerdem Timeouts, Positionswechsel und Eigentore festhalten, dazu die gegnerischen Spieler:innen je Partie (die stehen ja erst fest, wenn beide Spielpläne freigegeben sind – nachtragen geht jederzeit). Jeder Fehltipp lässt sich einzeln zurücknehmen' },
      { type: 'feat', text: 'Neue Auswertungen (Spieltage → 📊): Welche Doppel harmonieren, wie die Einzelbilanzen aussehen, wer trifft – und ob nach einem Timeout oder Positionswechsel das nächste Tor an euch ging. Quoten mit zu dünner Datenlage werden ausgegraut statt schöngerechnet' },
      { type: 'improve', text: 'Die Erfassung ist in jeder Feinheit freiwillig: nur Satzendstände reichen für Doppel- und Einzelbilanzen. Torschütz:innen und Timeout-Wirkung entstehen erst dort, wo live mitgetippt wurde – beides lässt sich innerhalb einer Begegnung mischen' },
      { type: 'improve', text: 'Spieltagsliste und Aufstellung zeigen das Ergebnis auf einen Blick, der Teilen-Text nimmt Satzpunkte und Tore mit. „Begegnung starten" sperrt die Aufstellung gleich mit' },
      { type: 'improve', text: 'Die Oberfläche spricht jetzt alle an: durchgehend „Spieler:innen" statt „Spieler" – mit Doppelpunkt, quer durch App, Onboarding, Einstellungen und Datenschutzerklärung' },
      { type: 'improve', text: 'Aufstellung: Die Sätze verteilen sich jetzt so gleichmäßig, wie die Regeln es zulassen. Bei sechs oder acht Personen bekommen alle exakt gleich viele – vorher lagen regelmäßig zwei Sätze dazwischen. Bei fünf Personen bleibt 4/4/5/5/6 das rechnerische Optimum, weil niemand mehr als zwei Einzel und zwei Doppel spielen darf' },
    ],
  },
  {
    version: '26.3.3',
    date: '2026-09-10',
    changes: [
      { type: 'feat', text: 'Liga-Verknüpfung: Im Spieler:innen-Profil und beim Team lässt sich die Seite des Hamburger Verbands hinterlegen – einfach den Link von kickern-hamburg.de einfügen, die ID wird herausgelesen. Danach führt ein Tipp direkt zu den eigenen Statistiken bzw. zu Tabelle und Ansetzungen. Die App ruft dort keine Daten ab, sie verlinkt nur' },
      { type: 'feat', text: 'Aufstellung sperren: Ist die Aufstellung fertig, lässt sie sich mit einem Tipp sperren – dann verschiebt kein versehentlicher Fingertipp mehr eine:n Spieler:in und „Neu berechnen" ist aus. Sperren und Entsperren dürfen Captain und Co-Captain; die Sperre gilt auch auf dem Server, nicht nur in der Ansicht' },
      { type: 'improve', text: 'Bei gesperrter Aufstellung bleibt der Bildschirm an, solange sie geöffnet ist – praktisch am Tisch. Braucht iPhone mit iOS 18.4 oder neuer bzw. Android; auf älteren Geräten bleibt es beim gewohnten Verhalten' },
      { type: 'fix', text: '„Neu berechnen" liefert jetzt zuverlässig eine andere Aufstellung. Bisher kam bei unveränderten Eingaben immer exakt dasselbe Ergebnis heraus, der Knopf wirkte dadurch kaputt – jetzt wird gezielt eine Variante gewürfelt, ohne dass Gleichverteilung oder Präferenzen darunter leiden' },
      { type: 'feat', text: 'Profilbilder: Spieler:innen, Teams und Vereine können ein Bild bekommen. Spieler:innen pflegen ihr eigenes, Captains und Co-Captains auch das der Mitspieler:innen; das Team-Logo setzt der Captain (Einstellungen → Verein), das Vereinslogo der Vereins-Admin' },
      { type: 'improve', text: 'Bilder werden direkt auf dem Gerät quadratisch zugeschnitten und verkleinert – auch iPhone-Fotos landen so klein und im richtigen Format im Speicher' },
      { type: 'improve', text: 'Profilbilder bleiben privat: sie liegen in einem nicht öffentlichen Speicher und sind ausschließlich für das eigene Team bzw. den eigenen Verein sichtbar' },
    ],
  },
  {
    version: '26.3.2',
    date: '2026-08-10',
    changes: [
      { type: 'feat', text: 'Vereins-Admins ernennen: unter „Verein" pro Verein aufklappbar; Plattform-Admins und bestehende Vereins-Admins dürfen weitere ernennen/entfernen (Übergabe möglich), der letzte Vereins-Admin bleibt geschützt' },
      { type: 'fix', text: 'Onboarding: frisch freigegebene Vereins-Admins ohne Team landen jetzt direkt in der Vereinsverwaltung (statt in der „Verein beantragen"-Sackgasse) und können ihr erstes Team anlegen' },
      { type: 'fix', text: 'Alle Auswahl-Menüs (Rollen, Aufstellungs-Slot, Vorschau, Workspace-Wechsel) öffnen jetzt zuverlässig auf dem Smartphone – einheitliches Menü statt nativem Auswahlfeld' },
      { type: 'fix', text: 'Letzter-Admin-/Captain-Schutz auch bei gleichzeitigen Änderungen sicher (serverseitig serialisiert)' },
      { type: 'improve', text: 'Allgemeinere Formulierungen – Hornstrike ist ein Team-Manager für die Hamburger Liga (nicht mehr auf ein einzelnes Team gemünzt); geteilte Aufstellungen zeigen jetzt euren eigenen Teamnamen' },
      { type: 'improve', text: 'Doppel einheitlich: oben immer Sturm, unten Tor – gleiche Reihenfolge (Sturm links, Tor rechts) in Editor und Aufstellungsliste; ein:e Spieler:in kann nicht mehr doppelt oder zweimal dieselbe Position belegen' },
      { type: 'improve', text: 'In „Mitglieder & Einladungen" ist der eigene Eintrag jetzt mit „Du" hervorgehoben' },
      { type: 'feat', text: 'Neue Rolle „Co-Captain": darf Kader, Spieltage, Umfragen & Aufstellungen verwalten, aber keine Mitglieder einladen oder Rollen vergeben' },
      { type: 'feat', text: 'Rollen von Mitgliedern zuweisen (Captain/Co-Captain/Spieler:in) unter Mitglieder & Einladungen; der letzte Captain eines Teams bleibt geschützt' },
      { type: 'fix', text: 'Einladung annehmen führt jetzt direkt ins Team; Vereins-Umbenennen als Plattform-Admin wieder möglich' },
      { type: 'feat', text: 'Impressum & Datenschutzerklärung ergänzt; Anmeldung/Beitritt erst nach Zustimmung zur Datenschutzerklärung' },
      { type: 'improve', text: 'Schriftart wird selbst ausgeliefert (kein Aufruf an Google Fonts) – datenschutzfreundlicher' },
      { type: 'fix', text: 'Sicherheits- & Datenschutz-Härtung: Kontolöschung möglich, Einladungen an E-Mail gebunden, robustere Fehlermeldungen' },
      { type: 'feat', text: 'Plattform-Admin: Nutzungs-Statistiken (Wachstum, Aktivierung, Engagement, Aktivität) – inklusive anonymer First-Party-Nutzungsmetriken, kein Drittanbieter-Tracking' },
      { type: 'feat', text: 'Heller & dunkler Modus umschaltbar (Einstellungen → Darstellung: Hell / Auto / Dunkel); die Auswahl wird gespeichert' },
      { type: 'feat', text: 'Neues helles Design in sanftem Lavendel mit gut lesbaren Akzentfarben – der dunkle Modus bleibt unverändert' },
      { type: 'improve', text: 'Footer-Icons vereinheitlicht: ein einheitliches Linien-Icon-Set statt gemischter Emojis' },
      { type: 'improve', text: 'Vereins- & Team-Verwaltung als eigener Footer-Tab für Admins (aus den Einstellungen ausgelagert)' },
      { type: 'fix', text: 'GitHub Actions: Node.js 24 Runtime für alle Actions erzwungen (Node 20 Deprecation)' },
      { type: 'feat', text: 'Aufstellung als Bild teilen oder herunterladen – Text- und Bild-Export im Teilen-Dropdown zusammengefasst' },
      { type: 'fix', text: 'Bild-Export: CORS-Fehler mit Google Fonts behoben (Font-Embedding übersprungen)' },
    ],
  },
  {
    version: '0.1.7',
    date: '2026-05-29',
    changes: [
      { type: 'improve', text: 'Beim Seitenwechsel wird automatisch nach oben gescrollt' },
      { type: 'fix', text: 'Bottom-Navigation Höhe springt nicht mehr beim Tab-Wechsel auf Mobilgeräten (feste Item-Dimensionen, Aktivierungs-Dot absolut positioniert, whitespace-nowrap)' },
      { type: 'fix', text: 'Goalie-Badge (🥅) wird auch nach nachträglicher Goalie-Aktivierung korrekt angezeigt' },
      { type: 'fix', text: 'Warnung wenn Spielfolge (Standard ↔ 5. Doppel) nachträglich geändert wurde und Aufstellung neu berechnet werden muss' },
      { type: 'improve', text: 'Regelverstoß- und Spielfolge-Banner sind schließbar; ⚠-Icon im Header zeigt aktive Regelverstöße dauerhaft an' },
      { type: 'improve', text: 'Spieler:innen mit Goalie-Präferenz werden mit sehr hoher Priorität auf E5/E6 gesetzt' },
    ],
  },
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
      { type: 'feat', text: 'Spieler:innen können im Kader als inaktiv markiert werden (z.B. bei Verletzung) – erscheinen dann nicht mehr bei der Spieltag-Planung' },
      { type: 'feat', text: 'Einstellungen: „App neu laden"-Button als manueller Fallback für SW-Updates' },
      { type: 'improve', text: 'Inaktiv-Toggle und Löschen-Button in den Spieler:innen-Editor verschoben' },
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
      { type: 'feat', text: 'Neue Spieler:innen-Präferenzen: Kein Starter (E1/E2) und Kein Finisher (letzte Spiele)' },
      { type: 'feat', text: 'Aufstellung teilen via Web Share API (WhatsApp, Telegram, …) oder Zwischenablage' },
      { type: 'feat', text: 'Onboarding-Guide für neue Nutzer:innen (6 Slides), jederzeit neu startbar' },
      { type: 'feat', text: 'Changelog als eigene Seite in den Einstellungen' },
      { type: 'feat', text: 'Home-Tab in der Bottom-Navigation' },
      { type: 'feat', text: 'Spieler:innen-Pills in der Aufstellung in individuellen Farben pro Spieler:in' },
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
      { type: 'improve', text: 'Spieler:innen-Editor komplett überarbeitet: 5-stufige Präferenz-Skala, Toggle-Switch für Goalie, tippbare Partner:innen-Pills' },
      { type: 'improve', text: 'Abschnitte: „Bevorzugte Position", „Bevorzugter Spieltyp", „Bevorzugte Partner:innen"' },
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
      { type: 'improve', text: 'Algorithmus: Ratio-basierte Penalty verhindert Dominanz einzelner Spieler:innen' },
    ],
  },
  {
    version: '0.1.0',
    date: '2026-05-28',
    changes: [
      { type: 'feat', text: 'Spieler:innen-Verwaltung mit dauerhaften Präferenzen (Position, Spieltyp, Goalie, Partner:innen)' },
      { type: 'feat', text: 'Spieltag-Planung mit Verfügbarkeit, Gegner, Datum, Goalie-Modus, 5. Doppel' },
      { type: 'feat', text: 'Automatische Aufstellung nach Hamburger Liga-Regeln' },
      { type: 'feat', text: 'Drag & Drop, Slot-Editor, Regelverstoß-Erkennung, Kampflos-Markierung' },
      { type: 'feat', text: 'Export & Import (JSON), Spieler:innen sortierbar' },
      { type: 'feat', text: 'PWA: installierbar auf iOS & Android, offline-fähig' },
      { type: 'feat', text: 'Deploy auf GitHub Pages via GitHub Actions' },
    ],
  },
]

// Datum des aktuellen Releases – beim `npm version`-Bump auf das Datum setzen
const CURRENT_DATE = '2026-09-16'

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
