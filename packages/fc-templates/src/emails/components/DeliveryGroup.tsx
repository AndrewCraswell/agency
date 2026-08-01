import type { ReactNode } from "react"
import { Section } from "react-email"
import { color, font, gutter } from "./tokens.ts"

/*
 * The heading over one parcel's worth of an order that arrives in several. It carries no rule of
 * its own: the item rows below already end in one, and a second line would read as a boundary
 * between groups rather than a title over the next.
 */

export type DeliveryGroupProps = {
  /** What this part of the order is, such as `Shipping items`. */
  readonly heading: ReactNode
  /** The small line over the estimate, such as `Estimated delivery`. */
  readonly estimateLabel?: ReactNode
  readonly estimate?: ReactNode
  /** A sentence about how this part behaves, such as being emailed when a pickup is ready. */
  readonly note?: ReactNode
}

export const DeliveryGroup = ({ estimate, estimateLabel, heading, note }: DeliveryGroupProps) => (
  <Section className="px" style={{ padding: `26px ${gutter}px 10px` }}>
    <div
      className="dk-text"
      style={{ color: color.ink, fontFamily: font.body, fontSize: 13, fontWeight: 700, lineHeight: "18px" }}
    >
      {heading}
    </div>
    {estimateLabel === undefined ? null : (
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "1.8px",
          lineHeight: "14px",
          paddingTop: 4
        }}
      >
        {estimateLabel}
      </div>
    )}
    {estimate === undefined ? null : (
      <div
        className="dk-text"
        style={{
          color: color.ink,
          fontFamily: font.body,
          fontSize: 11.5,
          fontWeight: 600,
          lineHeight: "16px",
          paddingTop: 4
        }}
      >
        {estimate}
      </div>
    )}
    {note === undefined ? null : (
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 11.5,
          fontWeight: 400,
          lineHeight: "17px",
          paddingTop: 4
        }}
      >
        {note}
      </div>
    )}
  </Section>
)
