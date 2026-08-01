import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { color, font, gutter, sectionGap } from "./tokens.ts"

/*
 * Who the order was for and how it was settled, boxed together. A receipt answers those questions
 * only when the reader goes looking, so they sit on a tinted card the eye can skip rather than in
 * the message's own column, where they would compete with what was bought.
 *
 * The two addresses and the two details are read against each other, so each pair is a two-up that
 * holds until a column would be too narrow for an address, rather than four blocks in a row.
 */

export type CustomerDetailProps = {
  /** The small caps line above the value, such as PAYMENT. */
  readonly label: string
  readonly children: ReactNode
  /** The quieter line under the value, such as when it was paid. */
  readonly note?: ReactNode
}

export const CustomerDetail = ({ children, label, note }: CustomerDetailProps) => (
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
        paddingBottom: 4
      }}
    >
      {label}
    </div>
    <div
      className="dk-text"
      style={{ color: color.ink, fontFamily: font.body, fontSize: 12.5, fontWeight: 700, lineHeight: "17px" }}
    >
      {children}
    </div>
    {note === undefined ? null : (
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 11.5,
          fontWeight: 400,
          lineHeight: "16px",
          paddingTop: 4
        }}
      >
        {note}
      </div>
    )}
  </>
)

export type CustomerInfoCardProps = {
  /** A band heading over the card, such as CUSTOMER INFORMATION. */
  readonly label?: string
  readonly shipTo: ReactNode
  readonly billTo: ReactNode
  readonly leftDetail: ReactNode
  readonly rightDetail: ReactNode
}

export const CustomerInfoCard = ({ billTo, label, leftDetail, rightDetail, shipTo }: CustomerInfoCardProps) => (
  <Section className="px" style={{ padding: `${sectionGap}px ${gutter}px 0` }}>
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
    <Section className="dk-surface" style={{ backgroundColor: color.surface, borderRadius: 14, padding: "20px 24px" }}>
      <Row>
        <Column className="pair" style={{ paddingRight: 12, verticalAlign: "top", width: "50%" }}>
          {shipTo}
        </Column>
        <Column className="pair" style={{ paddingLeft: 12, verticalAlign: "top", width: "50%" }}>
          {billTo}
        </Column>
      </Row>
      <Section style={{ padding: "16px 0" }}>
        <Section
          className="dk-border"
          style={{ backgroundColor: color.line, fontSize: 0, height: 1, lineHeight: "1px" }}
        />
      </Section>
      <Row>
        <Column className="pair" style={{ paddingRight: 12, verticalAlign: "top", width: "50%" }}>
          {leftDetail}
        </Column>
        <Column className="pair" style={{ paddingLeft: 12, verticalAlign: "top", width: "50%" }}>
          {rightDetail}
        </Column>
      </Row>
    </Section>
  </Section>
)
