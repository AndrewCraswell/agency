import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { IconChip } from "./FeatureList.tsx"
import type { LineIconName } from "./lineIcons.ts"
import { color, font, radius } from "./tokens.ts"

export type OptionCardItem = {
  readonly icon: LineIconName
  readonly name: string
  /** The one fact that separates this option from its neighbours, set small and in caps. */
  readonly meta: string
  readonly body: ReactNode
}

export type OptionCardsProps = {
  readonly items: readonly OptionCardItem[]
  /** The gap above the first card, which changes with what the band puts before it. */
  readonly spacing?: number
}

/** Boxed alternatives a reader is being asked to choose between, one card each. */
export const OptionCards = ({ items, spacing = 20 }: OptionCardsProps) => (
  <>
    {items.map((item, index) => (
      <Section key={item.name} style={{ paddingTop: index === 0 ? spacing : 12 }}>
        <Section
          className="dk-card dk-border"
          style={{
            backgroundColor: color.bg,
            border: `1px solid ${color.line}`,
            borderRadius: radius,
            padding: "18px 20px"
          }}
        >
          <Row>
            <Column style={{ paddingRight: 12, verticalAlign: "middle", width: 42 }}>
              <IconChip name={item.icon} tone="surface" />
            </Column>
            <Column style={{ verticalAlign: "middle" }}>
              <div
                className="dk-text"
                style={{
                  color: color.ink,
                  fontFamily: font.display,
                  fontSize: 19,
                  fontWeight: 700,
                  lineHeight: "23px"
                }}
              >
                {item.name}
              </div>
              <div
                className="dk-muted"
                style={{
                  color: color.inkSoft,
                  fontFamily: font.body,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  lineHeight: "15px",
                  paddingTop: 3
                }}
              >
                {item.meta}
              </div>
            </Column>
          </Row>
          <div
            className="dk-muted"
            style={{
              color: color.inkSoft,
              fontFamily: font.body,
              fontSize: 13,
              fontWeight: 400,
              lineHeight: "20px",
              paddingTop: 10
            }}
          >
            {item.body}
          </div>
        </Section>
      </Section>
    ))}
  </>
)

export type IconCardItem = {
  readonly icon: LineIconName
  readonly title: ReactNode
  readonly sub: ReactNode
  /** Where the card sends a reader; a card without one is a statement rather than an invitation. */
  readonly href?: string
}

export type IconCardsProps = {
  readonly items: readonly IconCardItem[]
  readonly spacing?: number
}

/** Boxed rows that each carry one glyph, one claim and one line of detail. */
export const IconCards = ({ items, spacing = 12 }: IconCardsProps) => (
  <>
    {items.map((item, index) => (
      <Section key={String(item.title)} style={{ paddingTop: index === 0 ? spacing : 10 }}>
        <Section
          className="dk-card dk-border"
          style={{
            backgroundColor: color.bg,
            border: `1px solid ${color.line}`,
            borderRadius: radius,
            padding: "14px 18px"
          }}
        >
          <Row>
            <Column style={{ paddingRight: 12, verticalAlign: "middle", width: 42 }}>
              <IconChip name={item.icon} tone="surface" />
            </Column>
            <Column className="appleLinks" style={{ verticalAlign: "middle" }}>
              <CardTitle href={item.href}>{item.title}</CardTitle>
              <div
                className="dk-muted"
                style={{
                  color: color.inkSoft,
                  fontFamily: font.body,
                  fontSize: 12.5,
                  fontWeight: 400,
                  lineHeight: "18px",
                  paddingTop: 2
                }}
              >
                {item.sub}
              </div>
            </Column>
          </Row>
        </Section>
      </Section>
    ))}
  </>
)

type CardTitleProps = {
  readonly children: ReactNode
  readonly href?: string
}

const titleStyle = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: 14,
  fontWeight: 700,
  lineHeight: "19px"
} as const

const CardTitle = ({ children, href }: CardTitleProps) => {
  if (href === undefined) {
    return (
      <div className="dk-text" style={titleStyle}>
        {children}
      </div>
    )
  }
  return (
    <a className="dk-text" href={href} style={{ ...titleStyle, display: "block" }}>
      {children}
    </a>
  )
}
