import type { ReactNode } from "react"
import { Button, Section } from "react-email"
import { color, font, gutter, radius, shopLinks } from "./tokens.ts"

export type SupportBandProps = {
  /** The one line that says how to get a person, usually naming the order. */
  readonly children: ReactNode
  readonly heading?: string
  /** Where the band sends a reader, for the messages whose first answer is a page rather than us. */
  readonly href?: string
  readonly label?: string
  /** Set where the band above already has a colour, so the white gap does not read as a cut edge. */
  readonly flush?: boolean
}

/*
 * The dark strip below the content that offers a human, used where no help card is needed. The
 * white band above it is the gap the design draws as the content block's bottom padding: a dark
 * table cannot hold white space of its own, so it is carried by a wrapper instead.
 */
export const SupportBand = ({
  children,
  flush = false,
  heading = "Need a hand?",
  href = shopLinks.contact,
  label = "Contact support"
}: SupportBandProps) => (
  <Section style={{ backgroundColor: color.bg, padding: flush ? 0 : "28px 0 0" }}>
    <Section
      className="px dk-band"
      style={{ backgroundColor: color.surfaceDark, padding: `28px ${gutter}px`, textAlign: "center" }}
    >
      <div style={{ color: color.onDark, fontFamily: font.body, fontSize: 17, fontWeight: 700, lineHeight: "22px" }}>
        {heading}
      </div>
      <div
        className="appleLinks"
        style={{
          color: color.onDarkSoft,
          fontFamily: font.body,
          fontSize: 13,
          fontWeight: 400,
          lineHeight: "20px",
          margin: "12px auto 0",
          maxWidth: 460
        }}
      >
        {children}
      </div>
      <div className="btn" style={{ paddingTop: 12 }}>
        <Button
          href={href}
          style={{
            backgroundColor: color.bg,
            borderRadius: radius,
            color: color.ink,
            fontFamily: font.body,
            fontSize: 14,
            fontWeight: 600,
            lineHeight: "18px",
            padding: "10px 24px",
            textDecoration: "none"
          }}
        >
          {label}
        </Button>
      </div>
    </Section>
  </Section>
)
