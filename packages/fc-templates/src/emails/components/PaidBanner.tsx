import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { color, font, gutter, radius } from "./tokens.ts"

export type PaidBannerProps = {
  /** The small caps line above the figure, such as TOTAL PAID. */
  readonly label: string
  readonly children: ReactNode
}

/*
 * The green card that confirms money has landed. The tick is a filled circle drawn from a table
 * cell rather than an image, so it survives the clients that block remote pictures by default.
 */
export const PaidBanner = ({ children, label }: PaidBannerProps) => (
  <Section className="px" style={{ padding: `24px ${gutter}px 0` }}>
    <Section
      style={{
        backgroundColor: color.paidSoft,
        border: `1px solid ${color.paidLine}`,
        borderCollapse: "separate",
        borderRadius: radius,
        padding: "20px 24px"
      }}
    >
      <Row>
        <Column style={{ paddingRight: 14, verticalAlign: "middle", width: 32 }}>
          <div
            style={{
              backgroundColor: color.paid,
              borderRadius: 16,
              color: color.accentInk,
              fontFamily: font.body,
              fontSize: 18,
              height: 32,
              lineHeight: "32px",
              textAlign: "center",
              width: 32
            }}
          >
            ✓
          </div>
        </Column>
        <Column style={{ verticalAlign: "middle" }}>
          <div
            style={{
              color: color.paid,
              fontFamily: font.body,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "1.5px",
              lineHeight: "14px"
            }}
          >
            {label}
          </div>
          <div
            style={{
              color: color.ink,
              fontFamily: font.display,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.5px",
              lineHeight: "32px",
              paddingTop: 2
            }}
          >
            {children}
          </div>
        </Column>
      </Row>
    </Section>
  </Section>
)
