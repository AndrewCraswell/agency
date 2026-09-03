import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { color, font, gutter, radius } from "./tokens.ts"

export type CategoryStripProps = {
  readonly items: readonly string[]
}

/*
 * The dark rule of collection names under a hero. A slash rather than a bullet keeps the row
 * readable when a client drops the letter-spacing, and it is a character every font actually has.
 */
export const CategoryStrip = ({ items }: CategoryStripProps) => (
  <Section
    className="px dk-band"
    style={{ backgroundColor: color.surfaceDark, padding: `16px ${gutter}px`, textAlign: "center" }}
  >
    <div style={{ color: color.onDark, fontFamily: font.body, fontSize: 11, fontWeight: 700, lineHeight: "18px" }}>
      {items.map((item, index) => (
        <span key={item}>
          {index > 0 && <span style={{ color: color.onDarkSoft, padding: "0 8px" }}>/</span>}
          <span style={{ letterSpacing: 1.5 }}>{item}</span>
        </span>
      ))}
    </div>
  </Section>
)

export type SpecItem = {
  readonly value: string
  readonly label: string
}

export type SpecStripProps = {
  readonly items: readonly SpecItem[]
  /** A dark strip states dates and windows; a grey one states product facts. */
  readonly tone?: "surface" | "dark"
}

/*
 * The row of headline numbers a launch leads with. A dark strip puts the label first, because
 * there a date only means something once you know which window it closes.
 */
export const SpecStrip = ({ items, tone = "surface" }: SpecStripProps) => {
  const dark = tone === "dark"
  const label = (item: SpecItem) => (
    <div
      className={dark ? undefined : "dk-muted"}
      style={{
        color: dark ? color.onDarkSoft : color.inkSoft,
        fontFamily: font.body,
        fontSize: dark ? 10 : 10.5,
        fontWeight: dark ? 700 : 500,
        letterSpacing: dark ? 1.4 : 0,
        lineHeight: "15px",
        padding: dark ? "0 0 6px" : "3px 0 0"
      }}
    >
      {item.label}
    </div>
  )
  return (
    <Section
      className={dark ? "px dk-band" : "px dk-surface"}
      style={{
        backgroundColor: dark ? color.surfaceDark : color.surface,
        padding: `22px ${gutter}px`,
        textAlign: "center"
      }}
    >
      <Row>
        {items.map((item, index) => (
          <Column
            className={dark ? "stack" : "stack dk-border"}
            key={item.value}
            style={{
              borderLeft: index === 0 ? "none" : `1px solid ${dark ? "rgba(255, 255, 255, 0.15)" : color.line}`,
              textAlign: "center",
              verticalAlign: "top"
            }}
          >
            {dark && label(item)}
            <div
              className={dark ? undefined : "dk-text"}
              style={{
                color: dark ? color.onDark : color.ink,
                fontFamily: font.display,
                fontSize: 20,
                fontWeight: 700,
                lineHeight: "26px"
              }}
            >
              {item.value}
            </div>
            {!dark && label(item)}
          </Column>
        ))}
      </Row>
    </Section>
  )
}

export type SplitCalloutProps = {
  readonly kicker: string
  readonly children: ReactNode
  readonly figure: string
  readonly unit: string
  readonly spacing?: number
}

/** A grey card that pairs one condition with the number it applies to. */
export const SplitCallout = ({ children, figure, kicker, spacing = 28, unit }: SplitCalloutProps) => (
  <Section className="px" style={{ padding: `${spacing}px ${gutter}px 0` }}>
    <Section
      className="dk-surface"
      style={{ backgroundColor: color.surface, borderRadius: radius, padding: "20px 24px" }}
    >
      <Row>
        <Column className="stack" style={{ verticalAlign: "middle" }}>
          <div
            className="dk-muted"
            style={{
              color: color.inkSoft,
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
            className="dk-text"
            style={{
              color: color.ink,
              fontFamily: font.body,
              fontSize: 14,
              fontWeight: 600,
              lineHeight: "20px",
              paddingTop: 5
            }}
          >
            {children}
          </div>
        </Column>
        <Column className="stack stack-left" style={{ textAlign: "right", verticalAlign: "middle", width: 110 }}>
          <div
            className="dk-text"
            style={{ color: color.ink, fontFamily: font.display, fontSize: 26, fontWeight: 700, lineHeight: "30px" }}
          >
            {figure}
          </div>
          <div
            className="dk-muted"
            style={{
              color: color.inkSoft,
              fontFamily: font.body,
              fontSize: 11,
              fontWeight: 400,
              lineHeight: "16px",
              paddingTop: 2
            }}
          >
            {unit}
          </div>
        </Column>
      </Row>
    </Section>
  </Section>
)
