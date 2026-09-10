// Verknüpfung mit den Liga-Seiten des Tischfußballverbands Hamburg.
// Die App ruft dort NICHTS ab (die Seite liefert Nicht-Browsern 410 und sendet
// keine CORS-Header) – sie verlinkt nur. Gespeichert wird ausschließlich die
// numerische ID, die Adresse entsteht hier.

const BASE = 'https://kickern-hamburg.de/liga'

export const ligaPlayerUrl = (id: number) => `${BASE}/spielerstatistiken?task=spieler_details&id=${id}`
export const ligaTeamUrl = (id: number) => `${BASE}/ergebnisse-und-tabellen?task=team_details&id=${id}`

/** Plausible Obergrenze – fängt Tippfehler wie eine eingefügte Telefonnummer ab. */
const MAX_ID = 9_999_999

/**
 * Nimmt entweder die blanke Zahl oder die komplette Profil-URL entgegen –
 * niemand soll im Browser nach einer Zahl suchen müssen, kopieren reicht.
 * Gibt `null` zurück, wenn nichts Brauchbares drinsteht.
 */
export function parseLigaId(input: string): number | null {
  const text = input.trim()
  if (!text) return null

  // (?:^|[?&]) statt bloßem /id=/: so wird auch ein abgetrenntes „id=2775"
  // erkannt, ohne versehentlich auf uid= oder teamid= zu treffen.
  const digits = /^\d+$/.test(text) ? text : text.match(/(?:^|[?&])id=(\d+)/)?.[1]
  if (!digits) return null

  const id = Number(digits)
  return Number.isInteger(id) && id > 0 && id <= MAX_ID ? id : null
}
