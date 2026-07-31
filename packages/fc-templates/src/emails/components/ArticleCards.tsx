import type { ReactNode } from "react"
import { Column, Img, Row, Section } from "react-email"
import { EmailButton } from "./EmailButton.tsx"
import { color, font, radius } from "./tokens.ts"

export type FeaturedArticleProps = {
  readonly href: string
  readonly image: string
  readonly badge?: string
  /** The section and the reading time, which is what makes a reader open an article or skip it. */
  readonly meta: string
  readonly title: string
  readonly excerpt: ReactNode
  readonly label: string
}

/** The lead story, given the full width and a button, because the rest of the issue is a list. */
export const FeaturedArticle = ({ badge, excerpt, href, image, label, meta, title }: FeaturedArticleProps) => (
  <Section style={{ paddingTop: 24, textAlign: "left" }}>
    <a href={href}>
      <Img
        alt={title}
        className="fluid"
        height={280}
        src={image}
        style={{ borderRadius: radius, objectFit: "cover", width: "100%" }}
        width={536}
      />
    </a>
    {badge !== undefined && (
      <div style={{ paddingTop: 14 }}>
        <span
          className="dk-chip"
          style={{
            backgroundColor: color.accent,
            borderRadius: 100,
            color: color.accentInk,
            display: "inline-block",
            fontFamily: font.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
            lineHeight: "14px",
            padding: "4px 10px"
          }}
        >
          {badge}
        </span>
      </div>
    )}
    <div
      className="dk-muted"
      style={{
        color: color.inkSoft,
        fontFamily: font.body,
        fontSize: 11.5,
        fontWeight: 500,
        letterSpacing: 0.6,
        lineHeight: "16px",
        paddingTop: badge === undefined ? 16 : 12
      }}
    >
      {meta}
    </div>
    <a
      className="dk-text"
      href={href}
      style={{
        color: color.ink,
        display: "block",
        fontFamily: font.display,
        fontSize: 24,
        fontWeight: 700,
        lineHeight: "30px",
        paddingTop: 6
      }}
    >
      {title}
    </a>
    <div
      className="dk-muted"
      style={{
        color: color.inkSoft,
        fontFamily: font.body,
        fontSize: 14,
        fontWeight: 400,
        lineHeight: "22px",
        paddingTop: 8
      }}
    >
      {excerpt}
    </div>
    <EmailButton href={href} spacing={20}>
      {label}
    </EmailButton>
  </Section>
)

export type ArticleCardItem = {
  readonly href: string
  readonly image: string
  readonly meta: string
  readonly title: string
  readonly excerpt: ReactNode
}

export type ArticleCardsProps = {
  readonly items: readonly ArticleCardItem[]
  readonly spacing?: number
}

const contentWidth = 536
const cardGap = 14

/** A pair of secondary stories. Column widths are fixed so a long title cannot starve its neighbour. */
export const ArticleCards = ({ items, spacing = 22 }: ArticleCardsProps) => {
  const width = Math.floor((contentWidth - cardGap * (items.length - 1)) / items.length)
  return (
    <Section style={{ paddingTop: spacing }}>
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
            <Section
              className="dk-card dk-border"
              style={{
                backgroundColor: color.bg,
                border: `1px solid ${color.line}`,
                borderRadius: radius,
                padding: 12
              }}
            >
              <a href={item.href}>
                <Img
                  alt={item.title}
                  className="fluid"
                  height={Math.round(width * 0.52)}
                  src={item.image}
                  style={{ borderRadius: 8, objectFit: "cover", width: "100%" }}
                  width={width - 24}
                />
              </a>
              <div
                className="dk-muted"
                style={{
                  color: color.inkSoft,
                  fontFamily: font.body,
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 0.6,
                  lineHeight: "15px",
                  paddingTop: 12
                }}
              >
                {item.meta}
              </div>
              <a
                className="dk-text"
                href={item.href}
                style={{
                  color: color.ink,
                  display: "block",
                  fontFamily: font.display,
                  fontSize: 15,
                  fontWeight: 700,
                  lineHeight: "20px",
                  paddingTop: 4
                }}
              >
                {item.title}
              </a>
              <div
                className="dk-muted"
                style={{
                  color: color.inkSoft,
                  fontFamily: font.body,
                  fontSize: 12.5,
                  fontWeight: 400,
                  lineHeight: "18px",
                  paddingTop: 6
                }}
              >
                {item.excerpt}
              </div>
            </Section>
          </Column>
        ))}
      </Row>
    </Section>
  )
}
