import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { color, font, gutter, radius, sectionGap } from "./tokens.ts"

/*
 * The grey card that carries the figures — a subtotal, an amount due, the card that was charged.
 *
 * Its own padding is short of the design's 20px because every row pads 6px above and below, which
 * is how the 12px gap between rows survives clients that drop `gap`. The two add up to the 20.
 */

export type SummaryCardProps = {
  readonly children: ReactNode
}

export const SummaryCard = ({ children }: SummaryCardProps) => (
  <Section className="px" style={{ padding: `${sectionGap}px ${gutter}px 0` }}>
    <Section
      className="dk-surface"
      style={{ backgroundColor: color.surface, borderRadius: radius, padding: "14px 24px" }}
    >
      {children}
    </Section>
  </Section>
)

export type SummaryRowProps = {
  readonly label: ReactNode
  readonly children: ReactNode
}

export const SummaryRow = ({ children, label }: SummaryRowProps) => (
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
        padding: "6px 0"
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
        fontSize: 13,
        fontWeight: 600,
        lineHeight: "18px",
        padding: "6px 0"
      }}
    >
      {children}
    </Column>
  </Row>
)
