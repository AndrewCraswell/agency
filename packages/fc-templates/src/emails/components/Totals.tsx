import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { color, font, gutter } from "./tokens.ts"

/*
 * The right-hand ledger a receipt closes with. Narrow and right-aligned so the figures line up
 * under the prices above them, rather than boxed like the payment card's summary.
 */

export type TotalsProps = {
  /** A band heading such as PAYMENT, for the ledgers that are not the order's own arithmetic. */
  readonly label?: ReactNode
  /** Run the full width, for a ledger that stands alone rather than under a column of prices. */
  readonly full?: boolean
  readonly children: ReactNode
}

export const Totals = ({ children, full = false, label }: TotalsProps) => (
  <Section className="px" style={{ padding: `12px ${gutter}px 0` }}>
    <Section align={full ? undefined : "right"} style={full ? { width: "100%" } : { marginLeft: "auto", width: 300 }}>
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
            paddingBottom: 10
          }}
        >
          {label}
        </div>
      )}
      {children}
    </Section>
  </Section>
)

export type TotalsRowProps = {
  readonly label: ReactNode
  readonly children: ReactNode
  /** A money-off line, which the design writes in the same green it uses for a paid state. */
  readonly credit?: boolean
}

export const TotalsRow = ({ children, credit = false, label }: TotalsRowProps) => (
  <Row>
    <Column
      align="left"
      className="dk-muted"
      style={{
        color: color.inkSoft,
        fontFamily: font.body,
        fontSize: 13,
        fontWeight: 400,
        lineHeight: "18px",
        padding: "3px 0"
      }}
    >
      {label}
    </Column>
    <Column
      align="right"
      className={credit ? undefined : "dk-text"}
      style={{
        color: credit ? color.paid : color.ink,
        fontFamily: font.body,
        fontSize: 13,
        fontWeight: 600,
        lineHeight: "18px",
        padding: "3px 0"
      }}
    >
      {children}
    </Column>
  </Row>
)

export type TotalsSumProps = {
  readonly label?: ReactNode
  readonly children: ReactNode
}

/** The last line, with the rule that separates it from the parts it adds up. */
export const TotalsSum = ({ children, label = "Total" }: TotalsSumProps) => (
  <>
    <Section style={{ padding: "6px 0" }}>
      {/* Mid grey rather than ink: clients that darken a message without reporting a scheme leave a
          near-black rule invisible, and this reads on both a white and a dark page. */}
      <Section
        className="dk-rule"
        style={{ backgroundColor: color.inkSoft, fontSize: 0, height: 1, lineHeight: "1px" }}
      />
    </Section>
    <Row>
      <Column
        align="left"
        className="dk-text"
        style={{
          color: color.ink,
          fontFamily: font.body,
          fontSize: 14,
          fontWeight: 700,
          lineHeight: "19px",
          padding: "3px 0"
        }}
      >
        {label}
      </Column>
      <Column
        align="right"
        className="dk-text"
        style={{
          color: color.ink,
          fontFamily: font.body,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: "20px",
          padding: "3px 0"
        }}
      >
        {children}
      </Column>
    </Row>
  </>
)
