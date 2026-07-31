import type { ReactNode } from "react"
import { Column, Img, Row, Section } from "react-email"
import { IconChip } from "./FeatureList.tsx"
import type { LineIconName } from "./lineIcons.ts"
import { color, font, radius } from "./tokens.ts"

export type MediaRowItem = {
  readonly image: string
  readonly title: string
  readonly body: ReactNode
}

export type MediaRowsProps = {
  readonly items: readonly MediaRowItem[]
  readonly spacing?: number
}

/*
 * Numbered picture-and-copy rows, for the launch emails that have to make the same claim three
 * times with different evidence. The numeral is text, so the row still counts itself when a client
 * blocks the picture.
 */
export const MediaRows = ({ items, spacing = 22 }: MediaRowsProps) => (
  <Section style={{ paddingTop: spacing }}>
    {items.map((item, index) => {
      const gap = index === 0 ? 0 : 18
      return (
        <Row key={item.title} style={{ borderCollapse: "separate" }}>
          <Column className="stack" style={{ paddingRight: 16, paddingTop: gap, verticalAlign: "top", width: 132 }}>
            <Img
              alt=""
              className="fluid"
              height={92}
              src={item.image}
              style={{ borderRadius: radius, objectFit: "cover", width: "100%" }}
              width={116}
            />
          </Column>
          <Column className="stack" style={{ paddingTop: gap, verticalAlign: "top" }}>
            <div
              className="dk-muted"
              style={{
                color: color.inkSoft,
                fontFamily: font.mono,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1,
                lineHeight: "15px"
              }}
            >
              {String(index + 1).padStart(2, "0")}
            </div>
            <div
              className="dk-text"
              style={{
                color: color.ink,
                fontFamily: font.display,
                fontSize: 17,
                fontWeight: 700,
                lineHeight: "22px",
                paddingTop: 3
              }}
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
                paddingTop: 4
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

export type TileItem = {
  readonly icon: LineIconName
  readonly label: string
  readonly line: string
}

export type TilesProps = {
  readonly items: readonly TileItem[]
  readonly spacing?: number
}

/** Side-by-side tiles that say the same kind of thing about each of a few audiences. */
export const Tiles = ({ items, spacing = 20 }: TilesProps) => (
  <Section style={{ paddingTop: spacing }}>
    <Row>
      {items.map((item, index) => (
        <Column
          align="center"
          className="stack"
          key={item.label}
          style={{ paddingLeft: index === 0 ? 0 : 12, textAlign: "center", verticalAlign: "top" }}
        >
          <IconChip name={item.icon} tone="surface" />
          <div
            className="dk-text"
            style={{
              color: color.ink,
              fontFamily: font.display,
              fontSize: 15,
              fontWeight: 700,
              lineHeight: "20px",
              paddingTop: 8
            }}
          >
            {item.label}
          </div>
          <div
            className="dk-muted"
            style={{
              color: color.inkSoft,
              fontFamily: font.body,
              fontSize: 12,
              fontWeight: 400,
              lineHeight: "17px",
              paddingTop: 2
            }}
          >
            {item.line}
          </div>
        </Column>
      ))}
    </Row>
  </Section>
)
