import { Section } from "react-email"
import { BandLead } from "./Band.tsx"
import { color, font, gutter } from "./tokens.ts"

export type OfferBandProps = {
  /** The saving, set as the largest thing in the email. */
  readonly figure: string
  readonly label: string
  /** Absent where the discount applies on its own, such as one tied to an account. */
  readonly code?: string
  /** Set where a band already precedes this one, so the white gap does not read as a cut edge. */
  readonly flush?: boolean
  /** What a reader has to know before the offer is worth anything, such as when it expires. */
  readonly note: string
}

/*
 * The dark strip that carries a discount. The code sits in a translucent box rather than a solid
 * one so the band reads as a single surface, which needs literal rgba: a client that strips the
 * alpha still lands on something close to the band behind it.
 */
export const OfferBand = ({ code, figure, flush = false, label, note }: OfferBandProps) => (
  <BandLead flush={flush}>
    <Section
      className="px dk-band"
      style={{ backgroundColor: color.surfaceDark, padding: `36px ${gutter}px`, textAlign: "center" }}
    >
      <div
        className="big-stat"
        style={{
          color: color.onDark,
          fontFamily: font.display,
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: -1,
          lineHeight: "48px"
        }}
      >
        {figure}
      </div>
      <div
        style={{
          color: color.onDark,
          fontFamily: font.body,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: "20px",
          paddingTop: 4
        }}
      >
        {label}
      </div>
      {code !== undefined && (
        <div style={{ paddingTop: 16 }}>
          <span
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 6,
              color: color.onDark,
              display: "inline-block",
              fontFamily: font.mono,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              lineHeight: "16px",
              padding: "5px 12px"
            }}
          >
            {code}
          </span>
        </div>
      )}
      <div
        style={{
          color: color.onDarkSoft,
          fontFamily: font.body,
          fontSize: 12,
          fontWeight: 400,
          lineHeight: "18px",
          paddingTop: 10
        }}
      >
        {note}
      </div>
    </Section>
  </BandLead>
)
