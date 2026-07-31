import { Column, Img, Row, Section } from "react-email"
import { color, font, radius } from "./tokens.ts"

export type ProductCardItem = {
  readonly href: string
  readonly image: string
  /** The collection the product sits in, set above the name. */
  readonly tag?: string
  readonly title: string
  /** What the name leaves out, such as the sizes a garment comes in. */
  readonly sub?: string
  readonly price?: string
  /** The words that stand in for a price where a launch is not quoting one yet. */
  readonly action?: string
  /** The pill under the picture, for the one or two cards a section wants to single out. */
  readonly badge?: string
}

export type ProductCardsProps = {
  readonly items: readonly ProductCardItem[]
  readonly spacing?: number
}

/* The measure inside a band's gutter, which the columns divide between them. */
const contentWidth = 536
const cardGap = 13

/*
 * A row of products. The columns carry `stack`, so what is a three-across grid on a desktop client
 * becomes three full-width cards on a phone rather than three unreadable slivers.
 */
export const ProductCards = ({ items, spacing = 24 }: ProductCardsProps) => {
  const width = Math.floor((contentWidth - cardGap * (items.length - 1)) / items.length)
  const imageHeight = Math.round(width * 0.88)
  return (
    <Section style={{ paddingTop: spacing }}>
      {/* Auto layout hands a card with a long name more room than its neighbours, so the widths are fixed. */}
      <Row style={{ tableLayout: "fixed", width: "100%" }}>
        {items.map((item, index) => (
          <Column
            className="stack"
            key={item.title}
            style={{
              paddingLeft: index === 0 ? 0 : cardGap,
              verticalAlign: "top",
              width: index === 0 ? width : width + cardGap
            }}
          >
            <a href={item.href}>
              <Img
                alt={item.title}
                className="fluid"
                height={imageHeight}
                src={item.image}
                style={{ borderRadius: radius, objectFit: "cover", width: "100%" }}
                width={width}
              />
            </a>
            {item.badge !== undefined && (
              <div style={{ paddingTop: 10 }}>
                <span
                  className="dk-chip"
                  style={{
                    backgroundColor: color.accent,
                    borderRadius: 100,
                    color: color.onDark,
                    display: "inline-block",
                    fontFamily: font.body,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 1,
                    lineHeight: "14px",
                    padding: "4px 10px"
                  }}
                >
                  {item.badge}
                </span>
              </div>
            )}
            {item.tag !== undefined && (
              <div
                className="dk-muted"
                style={{
                  color: color.inkSoft,
                  fontFamily: font.body,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 1,
                  lineHeight: "16px",
                  paddingTop: 10
                }}
              >
                {item.tag}
              </div>
            )}
            <a
              className="dk-text"
              href={item.href}
              style={{
                color: color.ink,
                display: "block",
                fontFamily: font.display,
                fontSize: 15,
                fontWeight: 600,
                lineHeight: "20px",
                paddingTop: item.tag === undefined ? 12 : 4
              }}
            >
              {item.title}
            </a>
            {item.sub !== undefined && (
              <div
                className="dk-muted"
                style={{
                  color: color.inkSoft,
                  fontFamily: font.body,
                  fontSize: 12,
                  fontWeight: 400,
                  lineHeight: "17px",
                  paddingTop: 3
                }}
              >
                {item.sub}
              </div>
            )}
            {item.price !== undefined && (
              <div
                className="dk-text"
                style={{
                  color: color.ink,
                  fontFamily: font.body,
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: "19px",
                  paddingTop: 6
                }}
              >
                {item.price}
              </div>
            )}
            {item.action !== undefined && (
              <a
                className="dk-text"
                href={item.href}
                style={{
                  borderBottom: `1px solid ${color.ink}`,
                  color: color.ink,
                  display: "inline-block",
                  fontFamily: font.body,
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: "18px",
                  marginTop: 8
                }}
              >
                {item.action}
              </a>
            )}
          </Column>
        ))}
      </Row>
    </Section>
  )
}
