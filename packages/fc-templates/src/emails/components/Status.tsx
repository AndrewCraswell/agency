import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { accentFill, color, font, gutter, radius } from "./tokens.ts"

export type StatusStripProps = {
  readonly children: ReactNode
  readonly tone?: "alert" | "positive"
}

/** The full-width bar that states a condition affecting everything below it. */
export const StatusStrip = ({ children, tone = "alert" }: StatusStripProps) => (
  <Section
    className="px"
    style={{
      backgroundColor: tone === "alert" ? color.focus : color.paid,
      padding: `10px ${gutter}px`,
      textAlign: "center"
    }}
  >
    <div
      style={{
        color: color.onDark,
        fontFamily: font.body,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: 1.6,
        lineHeight: "15px"
      }}
    >
      {children}
    </div>
  </Section>
)

export type NoticeBoxProps = {
  readonly kicker: string
  readonly children: ReactNode
  readonly spacing?: number
}

/** The tinted box for the one condition a reader has to act on before the deadline passes. */
export const NoticeBox = ({ children, kicker, spacing = 28 }: NoticeBoxProps) => (
  <Section className="px" style={{ padding: `${spacing}px ${gutter}px 0` }}>
    <Section style={{ backgroundColor: color.focusSoft, borderRadius: radius, padding: "18px 20px" }}>
      <div
        style={{
          color: color.focus,
          fontFamily: font.body,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 1.6,
          lineHeight: "14px"
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          color: color.focus,
          fontFamily: font.body,
          fontSize: 13.5,
          fontWeight: 500,
          lineHeight: "20px",
          paddingTop: 6
        }}
      >
        {children}
      </div>
    </Section>
  </Section>
)

export type ChecklistItem = {
  readonly title: string
  readonly note: ReactNode
}

export type ChecklistProps = {
  readonly items: readonly ChecklistItem[]
  readonly spacing?: number
}

/*
 * The tick is a character in a filled cell rather than an image, because a packing list that
 * renders as a column of broken pictures is worse than no list at all.
 */
export const Checklist = ({ items, spacing = 20 }: ChecklistProps) => (
  <Section style={{ paddingTop: spacing }}>
    {items.map((item, index) => {
      const gap = index === 0 ? 0 : 16
      return (
        <Row key={item.title} style={{ borderCollapse: "separate" }}>
          <Column style={{ paddingRight: 12, paddingTop: gap, verticalAlign: "top", width: 24 }}>
            <Row style={{ borderCollapse: "separate", width: 22 }}>
              <Column
                align="center"
                className="dk-num"
                style={{
                  backgroundColor: accentFill(),
                  borderRadius: 999,
                  color: color.onDark,
                  fontFamily: font.body,
                  fontSize: 12,
                  fontWeight: 700,
                  height: 22,
                  textAlign: "center",
                  verticalAlign: "middle",
                  width: 22
                }}
              >
                ✓
              </Column>
            </Row>
          </Column>
          <Column style={{ paddingTop: gap, verticalAlign: "top" }}>
            <div
              className="dk-text"
              style={{ color: color.ink, fontFamily: font.body, fontSize: 14.5, fontWeight: 700, lineHeight: "20px" }}
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
                lineHeight: "19px",
                paddingTop: 2
              }}
            >
              {item.note}
            </div>
          </Column>
        </Row>
      )
    })}
  </Section>
)
