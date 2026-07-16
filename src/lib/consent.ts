// Zustimmung zur Datenschutzerklärung (Voraussetzung für Login/Auth).
// Bei inhaltlicher Änderung der Erklärung DS_VERSION hochsetzen → alle Nutzer
// müssen erneut zustimmen.
export const DS_VERSION = '2026-07-16'

const KEY = 'hornstrike_ds_consent'

export function hasConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === DS_VERSION
  } catch {
    return false
  }
}

export function acceptConsent(): void {
  try {
    localStorage.setItem(KEY, DS_VERSION)
  } catch {
    /* Private-Mode o. ä. – ignorieren, Gate greift dann pro Sitzung */
  }
}
