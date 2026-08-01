import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { accentFill, color, font } from "./tokens.ts"

export type StepItem = {
  readonly title: string
  readonly body: ReactNode
}

export type StepListProps = {
  readonly items: readonly StepItem[]
  readonly spacing?: number
}

/*
 * A numbered sequence, for the messages that have to explain an order of operations. The numeral
 * is a table cell rather than an image, so a client that blocks images still shows the count.
 */
export const StepList = ({ items, spacing = 20 }: StepListProps) => (
  <Section style={{ paddingTop: spacing }}>
    {items.map((item, index) => {
      const gap = index === 0 ? 0 : 18
      return (
        <Row key={item.title} style={{ borderCollapse: "separate" }}>
          <Column style={{ paddingRight: 14, paddingTop: gap, verticalAlign: "top", width: 28 }}>
            <Row style={{ borderCollapse: "separate", width: 28 }}>
              <Column
                align="center"
                className="dk-num"
                style={{
                  backgroundColor: accentFill(),
                  borderRadius: 999,
                  color: color.onDark,
                  fontFamily: font.body,
                  fontSize: 13,
                  fontWeight: 700,
                  height: 28,
                  textAlign: "center",
                  verticalAlign: "middle",
                  width: 28
                }}
              >
                {index + 1}
              </Column>
            </Row>
          </Column>
          <Column style={{ paddingTop: gap, verticalAlign: "top" }}>
            <div
              className="dk-text"
              style={{ color: color.ink, fontFamily: font.body, fontSize: 15, fontWeight: 700, lineHeight: "20px" }}
            >
              {item.title}
            </div>
            <div
              className="dk-muted"
              style={{
                color: color.inkSoft,
                fontFamily: font.body,
                fontSize: 13,
                fontWeight: 400,
                lineHeight: "20px",
                paddingTop: 3
              }}
            >
              {item.body}
            </div>
          </Column>
        </Row>
      )
    })}
  </Section>
)
