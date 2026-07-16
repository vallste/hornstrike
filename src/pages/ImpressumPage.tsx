import type { ReactNode } from 'react'
import Header from '../components/Header'
import { LEGAL } from '../lib/legal'

const H = ({ children }: { children: ReactNode }) => (
  <h2 className="text-fg font-semibold text-[15px] mt-4 first:mt-0">{children}</h2>
)
const P = ({ children }: { children: ReactNode }) => (
  <p className="text-fg/70 text-sm leading-relaxed mt-1">{children}</p>
)

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-app pb-16">
      <div className="absolute w-[360px] h-[360px] rounded-full bg-unicorn-violet/35 blur-[140px] -top-20 right-0 pointer-events-none" />
      <Header title="Impressum" back />

      <div className="relative px-6 mt-4 space-y-4">
        <div className="bg-surface rounded-2xl p-5">
          <H>Angaben gemäß § 5 DDG</H>
          <P>{LEGAL.name}<br />{LEGAL.street}<br />{LEGAL.city}</P>

          <H>Kontakt</H>
          <P>E-Mail: {LEGAL.email}{LEGAL.phone && <><br />Telefon: {LEGAL.phone}</>}</P>

          <H>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</H>
          <P>{LEGAL.name}, {LEGAL.street}, {LEGAL.city}</P>

          <H>Haftung für Inhalte</H>
          <P>
            Als Diensteanbieter sind wir für eigene Inhalte auf diesen Seiten nach den allgemeinen
            Gesetzen verantwortlich. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte
            wird jedoch keine Gewähr übernommen.
          </P>
        </div>
      </div>
    </div>
  )
}
