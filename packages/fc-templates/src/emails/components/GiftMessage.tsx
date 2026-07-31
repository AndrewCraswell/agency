import type { ReactNode } from "react"
import { Section } from "react-email"
import { color, font, gutter, radius } from "./tokens.ts"

export type GiftMessageProps = {
  /** Who wrote it, shown under the words. */
  readonly from: ReactNode
  readonly children: ReactNode
}

/** The words one person wrote for another, set apart so they do not read as ours. */
export const GiftMessage = ({ children, from }: GiftMessageProps) => (
  <Section className="px" style={{ padding: `22px ${gutter}px 0` }}>
    <Section
      className="dk-surface"
      style={{ backgroundColor: color.surface, borderRadius: radius, padding: "24px 28px", textAlign: "center" }}
    >
      <div
        className="dk-text"
        style={{
          color: color.ink,
          fontFamily: font.body,
          fontSize: 15,
          fontStyle: "italic",
          fontWeight: 400,
          lineHeight: "24px"
        }}
      >
        “{children}”
      </div>
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 13,
          fontWeight: 600,
          lineHeight: "18px",
          paddingTop: 10
        }}
      >
        From {from}
      </div>
    </Section>
  </Section>
)
