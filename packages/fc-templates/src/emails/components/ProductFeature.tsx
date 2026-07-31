import type { ReactNode } from "react"
import { Column, Img, Row, Section } from "react-email"
import { EmailButton } from "./EmailButton.tsx"
import { color, font, radius } from "./tokens.ts"

export type FeaturedProductProps = {
  readonly href: string
  readonly image: string
  /** The pill above the name, for the fact that made the email worth sending. */
  readonly badge?: string
  readonly tag: string
  readonly title: string
  /** The short qualifiers under the name, such as a size or a weapon. */
  readonly facts?: readonly string[]
  readonly price?: string
  /** The tinted line that says why this cannot wait. */
  readonly urgency?: ReactNode
  readonly action: string
}

/*
 * One product given the whole width, for the emails that exist because of it. It carries no gutter
 * of its own, so it can sit inside a hero or a band without doubling the margin.
 */
export const FeaturedProduct = ({
  action,
  badge,
  facts,
  href,
  image,
  price,
  tag,
  title,
  urgency
}: FeaturedProductProps) => (
  <Section
    className="dk-surface"
    style={{ backgroundColor: color.surface, borderRadius: radius, marginTop: 24, padding: 12, textAlign: "left" }}
  >
    <a href={href}>
      <Img
        alt={title}
        className="fluid"
        height={260}
        src={image}
        style={{ borderRadius: 10, objectFit: "cover", width: "100%" }}
        width={512}
      />
    </a>
    <Section className="dk-card" style={{ backgroundColor: color.bg, borderRadius: 10, marginTop: 12, padding: 18 }}>
      {badge !== undefined && (
        <div style={{ paddingBottom: 10 }}>
          <span
            style={{
              backgroundColor: color.paid,
              borderRadius: 100,
              color: color.onDark,
              display: "inline-block",
              fontFamily: font.body,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
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
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 1,
          lineHeight: "16px"
        }}
      >
        {tag}
      </div>
      <a
        className="dk-text"
        href={href}
        style={{
          color: color.ink,
          display: "block",
          fontFamily: font.display,
          fontSize: 22,
          fontWeight: 700,
          lineHeight: "27px",
          paddingTop: 4
        }}
      >
        {title}
      </a>
      <Row style={{ borderCollapse: "separate" }}>
        <Column style={{ paddingTop: 12, verticalAlign: "middle" }}>
          {facts?.map((fact) => (
            <span
              className="dk-surface dk-text"
              key={fact}
              style={{
                backgroundColor: color.surface,
                borderRadius: 100,
                color: color.ink,
                display: "inline-block",
                fontFamily: font.body,
                fontSize: 12,
                fontWeight: 600,
                lineHeight: "16px",
                marginRight: 8,
                padding: "6px 12px"
              }}
            >
              {fact}
            </span>
          ))}
        </Column>
        {price !== undefined && (
          <Column style={{ paddingTop: 12, textAlign: "right", verticalAlign: "middle", width: 90 }}>
            <span
              className="dk-text"
              style={{ color: color.ink, fontFamily: font.body, fontSize: 18, fontWeight: 700, lineHeight: "24px" }}
            >
              {price}
            </span>
          </Column>
        )}
      </Row>
      {urgency !== undefined && (
        <div
          style={{
            backgroundColor: color.focusSoft,
            borderRadius: 8,
            color: color.focus,
            fontFamily: font.body,
            fontSize: 12.5,
            fontWeight: 600,
            lineHeight: "18px",
            marginTop: 14,
            padding: "9px 12px"
          }}
        >
          {urgency}
        </div>
      )}
      <EmailButton href={href} spacing={14}>
        {action}
      </EmailButton>
    </Section>
  </Section>
)

export type PurchasedCardProps = {
  readonly href: string
  readonly image: string
  readonly tag: string
  readonly title: string
  /** Which order this came from and when it arrived, so the reader knows what is being asked about. */
  readonly meta: ReactNode
}

/** The thing an email is asking about, restated so the reader does not have to remember it. */
export const PurchasedCard = ({ href, image, meta, tag, title }: PurchasedCardProps) => (
  <Section
    className="dk-surface"
    style={{ backgroundColor: color.surface, borderRadius: radius, marginTop: 24, padding: 12, textAlign: "left" }}
  >
    <Row>
      <Column className="stack" style={{ paddingRight: 14, verticalAlign: "middle", width: 112 }}>
        <Img
          alt={title}
          className="fluid"
          height={98}
          src={image}
          style={{ borderRadius: 10, objectFit: "cover", width: "100%" }}
          width={98}
        />
      </Column>
      <Column className="stack" style={{ verticalAlign: "middle" }}>
        <div
          className="dk-muted"
          style={{
            color: color.inkSoft,
            fontFamily: font.body,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 1,
            lineHeight: "16px"
          }}
        >
          {tag}
        </div>
        <a
          className="dk-text"
          href={href}
          style={{
            color: color.ink,
            display: "block",
            fontFamily: font.display,
            fontSize: 18,
            fontWeight: 700,
            lineHeight: "23px",
            paddingTop: 3
          }}
        >
          {title}
        </a>
        <div
          className="dk-muted"
          style={{
            color: color.inkSoft,
            fontFamily: font.body,
            fontSize: 12.5,
            fontWeight: 400,
            lineHeight: "18px",
            paddingTop: 4
          }}
        >
          {meta}
        </div>
      </Column>
    </Row>
  </Section>
)

export type RatePromptProps = {
  readonly kicker: string
  readonly prompt: string
  readonly hint: string
}

/*
 * The star row is text, not an image: a review ask that renders as five broken pictures asks
 * nothing at all.
 */
export const RatePrompt = ({ hint, kicker, prompt }: RatePromptProps) => (
  <Section
    className="dk-card"
    style={{
      backgroundColor: color.bg,
      borderRadius: radius,
      padding: "26px 24px",
      textAlign: "center"
    }}
  >
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
        fontFamily: font.display,
        fontSize: 22,
        fontWeight: 700,
        lineHeight: "28px",
        paddingTop: 6
      }}
    >
      {prompt}
    </div>
    <div
      className="dk-text"
      style={{
        color: color.ink,
        fontFamily: font.body,
        fontSize: 26,
        letterSpacing: 6,
        lineHeight: "34px",
        paddingTop: 10
      }}
    >
      ★★★★★
    </div>
    <div
      className="dk-muted"
      style={{
        color: color.inkSoft,
        fontFamily: font.body,
        fontSize: 12,
        fontWeight: 400,
        lineHeight: "18px",
        paddingTop: 8
      }}
    >
      {hint}
    </div>
  </Section>
)
