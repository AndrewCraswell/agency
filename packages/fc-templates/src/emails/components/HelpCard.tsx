import type { ReactNode } from "react"
import { Section } from "react-email"
import { color, font, gutter, radius, sectionGap } from "./tokens.ts"

export type HelpCardProps = {
  /** The small caps line above the question, such as GOOD TO KNOW. */
  readonly kicker: string
  readonly headline: ReactNode
  readonly children: ReactNode
}

/** The quiet grey card that answers the question the message itself raises. */
export const HelpCard = ({ children, headline, kicker }: HelpCardProps) => (
  <Section className="px" style={{ padding: `${sectionGap}px ${gutter}px 0` }}>
    <Section
      className="dk-surface"
      style={{ backgroundColor: color.surface, borderRadius: radius, padding: "18px 20px" }}
    >
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.4,
          lineHeight: "16px"
        }}
      >
        {kicker}
      </div>
      <div
        className="dk-text"
        style={{
          color: color.ink,
          fontFamily: font.body,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: "20px",
          paddingTop: 8
        }}
      >
        {headline}
      </div>
      <div
        className="dk-muted appleLinks"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 13,
          fontWeight: 400,
          lineHeight: "21px",
          paddingTop: 8
        }}
      >
        {children}
      </div>
    </Section>
  </Section>
)
