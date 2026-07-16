import type { ReactNode } from 'react'
import Header from '../components/Header'
import { DS_VERSION } from '../lib/consent'
import { LEGAL } from '../lib/legal'

const H = ({ children }: { children: ReactNode }) => (
  <h2 className="text-fg font-semibold text-[15px] mt-5 first:mt-0">{children}</h2>
)
const P = ({ children }: { children: ReactNode }) => (
  <p className="text-fg/70 text-sm leading-relaxed mt-1.5">{children}</p>
)
const Li = ({ children }: { children: ReactNode }) => (
  <li className="text-fg/70 text-sm leading-relaxed">{children}</li>
)

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-app pb-16">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title="Datenschutzerklärung" back />

      <div className="relative px-6 mt-4 space-y-4">
        <div className="bg-surface rounded-2xl p-5">
          <H>1. Verantwortlicher</H>
          <P>{LEGAL.name}, {LEGAL.street}, {LEGAL.city}. E-Mail: {LEGAL.email}. Siehe auch das Impressum.</P>

          <H>2. Welche Daten wir verarbeiten</H>
          <ul className="list-disc pl-5 mt-1.5 space-y-1">
            <Li><b>Kontodaten:</b> E-Mail-Adresse (für den passwortlosen Login) sowie technische Anmeldedaten.</Li>
            <Li><b>Spielerprofile:</b> Name, Positions- und Spieltyp-Vorlieben, Torwart-Präferenz, Partnerwünsche, Verfügbarkeiten.</Li>
            <Li><b>Team-/Vereinsdaten:</b> Vereine, Teams, Mitgliedschaften/Rollen, Spieltage, Aufstellungen, Umfragen und Antworten.</Li>
            <Li><b>Nutzungsdaten:</b> pseudonyme Ereignisse zur Reichweitenmessung und Produktverbesserung – z.&nbsp;B. aufgerufene Seiten als <i>Muster</i> (ohne konkrete IDs, z.&nbsp;B. „/players/:id“), ausgelöste Aktionen, Zeitpunkt und Anzeige-Modus. Es werden dabei <b>keine</b> Namen, E-Mails oder Klartext-Inhalte gespeichert.</Li>
          </ul>

          <H>3. Zwecke &amp; Rechtsgrundlagen</H>
          <ul className="list-disc pl-5 mt-1.5 space-y-1">
            <Li>Bereitstellung der App und ihrer Funktionen – Art. 6 Abs. 1 lit. b DSGVO (Nutzungsverhältnis).</Li>
            <Li>Versand der Login-Codes per E-Mail – Art. 6 Abs. 1 lit. b DSGVO.</Li>
            <Li>Nutzungsstatistik – deine <b>Einwilligung</b> (beim Login abgefragt), Art. 6 Abs. 1 lit. a DSGVO; jederzeit mit Wirkung für die Zukunft widerrufbar.</Li>
          </ul>

          <H>4. Empfänger / Auftragsverarbeiter</H>
          <ul className="list-disc pl-5 mt-1.5 space-y-1">
            <Li><b>Supabase</b> (Datenbank, Authentifizierung, Hosting der Daten), Region EU (Frankfurt). Es besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.</Li>
            <Li><b>Resend</b> (Versand der Login-E-Mails), USA. Es besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO; die Übermittlung in die USA ist durch die EU-Standardvertragsklauseln abgesichert.</Li>
            <Li><b>ImprovMX</b> (Weiterleitung von E-Mails an die Kontaktadresse), Datenspeicherung in der EU (Frankreich, OVH). Verarbeitet eingehende Kontakt-E-Mails; es besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO.</Li>
            <Li><b>Hosting der Anwendung:</b> GitHub Pages (GitHub Inc., USA). Die App wird als statische Dateien über GitHub ausgeliefert; dabei wird deine IP-Adresse an GitHub übermittelt (Drittland USA, abgesichert über Standardvertragsklauseln bzw. das GitHub-Datenschutz-Addendum).</Li>
            <Li>Schriftarten werden <b>selbst gehostet</b> – es findet keine Übermittlung an Google Fonts statt. Es sind keine weiteren Drittanbieter-Tracker eingebunden.</Li>
          </ul>

          <H>5. Speicherdauer</H>
          <P>
            Konto-, Spieler- und Vereinsdaten werden gespeichert, solange das Konto bzw. die Team-Zugehörigkeit
            besteht. Nutzungsereignisse werden nach 180 Tagen automatisch gelöscht. Bei Löschung
            eines Kontos wird der Personenbezug in verbleibenden Ereignissen entfernt.
          </P>

          <H>6. Minderjährige</H>
          <P>
            Für Spielerinnen und Spieler unter 16 Jahren ist die Einwilligung der Erziehungsberechtigten
            erforderlich. Die Namen jugendlicher Spieler werden ausschließlich durch die jeweils
            verantwortliche Team-Leitung (Captain bzw. Vereins-Admin) eingetragen. Diese ist dafür
            verantwortlich, vor der Eingabe die erforderliche Einwilligung der Erziehungsberechtigten
            einzuholen und nachzuweisen.
          </P>

          <H>7. Deine Rechte</H>
          <P>
            Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung,
            Datenübertragbarkeit sowie Widerspruch. Erteilte Einwilligungen kannst du jederzeit widerrufen.
            Wende dich dazu an {LEGAL.email}.
          </P>

          <H>8. Beschwerderecht</H>
          <P>
            Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, z.&nbsp;B. beim
            Hamburgischen Beauftragten für Datenschutz und Informationsfreiheit.
          </P>

          <H>9. Keine automatisierte Entscheidungsfindung</H>
          <P>Es findet kein Profiling mit rechtlicher Wirkung und keine automatisierte Entscheidungsfindung statt.</P>

          <p className="text-fg/35 text-xs mt-6">
            Stand dieser Erklärung: {new Date(DS_VERSION + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  )
}
