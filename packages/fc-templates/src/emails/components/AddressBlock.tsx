import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { color, font, gutter } from "./tokens.ts"

export type AddressDetailProps = {
  /** The small caps line above the name, such as SHIP TO. */
  readonly kicker: string
  readonly headline: ReactNode
  readonly children?: ReactNode
}

/*
 * A place, written the way a place is written: a name, then the lines under it. Unboxed, because
 * it sits inside the message rather than beside it, and a card would read as a second subject.
 */
export const AddressDetail = ({ children, headline, kicker }: AddressDetailProps) => (
  <>
    <div
      className="dk-muted"
      style={{
        color: color.inkSoft,
        fontFamily: font.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "1.8px",
        lineHeight: "14px",
        paddingBottom: 6
      }}
    >
      {kicker}
    </div>
    <div
      className="dk-text"
      style={{ color: color.ink, fontFamily: font.body, fontSize: 12.5, fontWeight: 700, lineHeight: "17px" }}
    >
      {headline}
    </div>
    {children === undefined ? null : (
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 11.5,
          fontWeight: 400,
          lineHeight: "17px",
          paddingTop: 2
        }}
      >
        {children}
      </div>
    )}
  </>
)

export type AddressBlockProps = AddressDetailProps

export const AddressBlock = (props: AddressBlockProps) => (
  <Section className="px" style={{ padding: `8px ${gutter}px 24px` }}>
    <AddressDetail {...props} />
  </Section>
)

export type AddressPairProps = {
  /** A band heading over both halves, such as SHIPPING & PAYMENT. */
  readonly label?: string
  readonly left: ReactNode
  readonly right: ReactNode
}

/*
 * Two halves rather than one after the other, because an address and its billing twin are read
 * against each other rather than in sequence.
 */
export const AddressPair = ({ label, left, right }: AddressPairProps) => (
  <Section className="px" style={{ padding: `18px ${gutter}px 8px` }}>
    {label === undefined ? null : (
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "2px",
          lineHeight: "16px",
          paddingBottom: 12
        }}
      >
        {label}
      </div>
    )}
    <Row>
      <Column className="stack" style={{ paddingRight: 12, verticalAlign: "top", width: "50%" }}>
        {left}
      </Column>
      <Column className="stack" style={{ paddingLeft: 12, verticalAlign: "top", width: "50%" }}>
        {right}
      </Column>
    </Row>
  </Section>
)
