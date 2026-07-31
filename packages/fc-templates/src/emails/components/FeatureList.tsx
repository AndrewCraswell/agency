import type { ReactNode } from "react"
import { Column, Img, Row, Section } from "react-email"
import { lineIcon, type LineIconName } from "./lineIcons.ts"
import { color, font } from "./tokens.ts"

export type IconChipProps = {
  readonly name: LineIconName
  /** An outlined chip reads against a page; a filled one reads against a card that is already outlined. */
  readonly tone?: "outline" | "surface"
}

/*
 * The chip keeps its light background in dark mode on purpose: the glyphs are dark strokes on
 * transparency, so inverting the chip would hide them.
 */
export const IconChip = ({ name, tone = "outline" }: IconChipProps) => (
  /* A cell centres the glyph on both axes where an inline-block and a line height do not. */
  <Row style={{ borderCollapse: "separate", width: 42 }}>
    <Column
      align="center"
      style={{
        backgroundColor: tone === "outline" ? color.bg : color.surface,
        border: tone === "outline" ? `1px solid ${color.line}` : "none",
        borderRadius: 999,
        height: 40,
        verticalAlign: "middle",
        width: 40
      }}
    >
      <Img alt="" height={19} src={lineIcon[name]} style={{ display: "block", margin: "0 auto" }} width={19} />
    </Column>
  </Row>
)

export type FeatureItem = {
  readonly body: ReactNode
  readonly icon: LineIconName
  readonly title: string
}

export type FeatureListProps = {
  readonly items: readonly FeatureItem[]
}

/** The icon-and-copy rows a band uses to make a claim three times without three paragraphs. */
export const FeatureList = ({ items }: FeatureListProps) => (
  <Section style={{ paddingTop: 22 }}>
    {items.map((item, index) => {
      /* A row is a table, and clients drop padding set on one, so the gap goes on its cells. */
      const gap = index === 0 ? 0 : 16
      return (
        <Row key={item.title}>
          <Column style={{ paddingRight: 14, paddingTop: gap, verticalAlign: "top", width: 40 }}>
            <IconChip name={item.icon} />
          </Column>
          <Column style={{ paddingTop: gap, textAlign: "left", verticalAlign: "top" }}>
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
