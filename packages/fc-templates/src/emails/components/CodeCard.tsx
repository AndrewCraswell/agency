import type { ReactNode } from "react"
import { Section } from "react-email"
import { color, font, gutter, radius } from "./tokens.ts"

export type CodeCardProps = {
  /** The small caps line above the code, such as GIFT CARD CODE. */
  readonly label: string
  /** What to do with the code, under it. */
  readonly children: ReactNode
  readonly code: ReactNode
}

/*
 * A code someone has to read off the screen and type somewhere else, so it is set in the mono
 * face and widely tracked: the point is telling an O from a 0, not looking like the rest of the
 * message.
 */
export const CodeCard = ({ children, code, label }: CodeCardProps) => (
  <Section className="px" style={{ padding: `22px ${gutter}px 0` }}>
    <Section
      className="dk-surface dk-border"
      style={{
        backgroundColor: color.surface,
        border: `1px solid ${color.line}`,
        borderCollapse: "separate",
        borderRadius: radius,
        padding: "20px 24px",
        textAlign: "center"
      }}
    >
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "2px",
          lineHeight: "14px"
        }}
      >
        {label}
      </div>
      <div
        className="dk-text appleLinks"
        style={{
          color: color.ink,
          fontFamily: font.mono,
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "4px",
          lineHeight: "26px",
          paddingTop: 8
        }}
      >
        {code}
      </div>
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 11.5,
          fontWeight: 400,
          lineHeight: "17px",
          paddingTop: 8
        }}
      >
        {children}
      </div>
    </Section>
  </Section>
)
