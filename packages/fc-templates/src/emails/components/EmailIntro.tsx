import type { ReactNode } from "react"
import { Section } from "react-email"
import { color, font, gutter } from "./tokens.ts"

/*
 * The opening of every email: one line that says what happened, then one paragraph that says what
 * it means. `h1` carries the class the mobile rules key off, so the headline steps down on a phone
 * while the rest of the type holds.
 */

export type EmailTitleProps = {
  readonly children: ReactNode
}

export const EmailTitle = ({ children }: EmailTitleProps) => (
  <Section className="px" style={{ padding: `40px ${gutter}px 0`, textAlign: "center" }}>
    <h1
      className="h1 dk-text"
      style={{
        color: color.ink,
        fontFamily: font.display,
        fontSize: 30,
        fontWeight: 700,
        letterSpacing: -0.5,
        lineHeight: "36px",
        margin: 0
      }}
    >
      {children}
    </h1>
  </Section>
)

export type EmailLeadProps = {
  readonly children: ReactNode
}

export const EmailLead = ({ children }: EmailLeadProps) => (
  <Section className="px" style={{ padding: `18px ${gutter}px 0`, textAlign: "center" }}>
    <div
      className="sub dk-muted"
      style={{
        color: color.inkSoft,
        fontFamily: font.body,
        fontSize: 15,
        fontWeight: 400,
        lineHeight: "24px",
        margin: "0 auto",
        maxWidth: 472
      }}
    >
      {children}
    </div>
  </Section>
)
