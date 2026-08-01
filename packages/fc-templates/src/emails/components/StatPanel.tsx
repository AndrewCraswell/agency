import type { ReactNode } from "react"
import { Section } from "react-email"
import { color, font, gutter, radius, sectionGap } from "./tokens.ts"

export type StatPanelProps = {
  /** The small caps line above the figure, such as CREDIT ADDED. */
  readonly label: string
  /** A qualifier under the figure, such as when it stops being worth anything. */
  readonly note?: ReactNode
  readonly children: ReactNode
}

/*
 * The dark panel that states one number and nothing else, for the messages whose whole point is a
 * figure. `big-stat` is what the mobile rules step down, so the number never wraps on a phone.
 */
export const StatPanel = ({ children, label, note }: StatPanelProps) => (
  <Section className="px" style={{ padding: `${sectionGap}px ${gutter}px 0` }}>
    <Section
      className="dk-band"
      style={{
        backgroundColor: color.surfaceDark,
        borderRadius: radius,
        padding: "28px 24px",
        textAlign: "center"
      }}
    >
      <div
        style={{
          color: color.onDarkSoft,
          fontFamily: font.body,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          lineHeight: "14px"
        }}
      >
        {label}
      </div>
      <div
        className="big-stat"
        style={{
          color: color.onDark,
          fontFamily: font.display,
          fontSize: 44,
          fontWeight: 700,
          letterSpacing: -1,
          lineHeight: "50px",
          paddingTop: 6
        }}
      >
        {children}
      </div>
      {note === undefined ? null : (
        <div
          style={{
            color: color.onDarkSoft,
            fontFamily: font.body,
            fontSize: 11,
            fontWeight: 400,
            lineHeight: "16px",
            paddingTop: 6
          }}
        >
          {note}
        </div>
      )}
    </Section>
  </Section>
)
