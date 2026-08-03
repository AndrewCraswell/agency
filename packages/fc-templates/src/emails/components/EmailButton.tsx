import type { ReactNode } from "react"
import { Button, Column, Row, Section } from "react-email"
import { accentFill, color, font, gutter, radius } from "./tokens.ts"

export type EmailButtonProps = {
  readonly href: string
  readonly children: ReactNode
  /** A second action beside the first reads as a choice; the quieter one is outlined. */
  readonly variant?: "primary" | "secondary" | "inverse" | "shop"
  /** The gap above the button, which a tighter marketing stack sets smaller than a notification. */
  readonly spacing?: number
}

type Variant = NonNullable<EmailButtonProps["variant"]>

/* Read at render rather than declared once, because the accent resolves against the live values. */
const buttonBackground = (variant: Variant): string => {
  if (variant === "primary") {
    return accentFill()
  }
  if (variant === "shop") {
    return color.shop
  }
  return variant === "inverse" ? color.bg : "transparent"
}

/*
 * Gmail's dark mode rewrites a background but leaves a border alone, so a filled button it darkens
 * to the page colour still shows its edge. The hairline is the page colour, so nothing else sees it.
 */
const buttonBorder = (variant: Variant): string => {
  if (variant === "secondary") {
    return `1px solid ${color.line}`
  }
  if (variant === "shop") {
    return `1px solid ${color.shop}`
  }
  return variant === "primary" ? `1px solid ${color.bg}` : "none"
}

const buttonInk = (variant: Variant): string =>
  variant === "primary" || variant === "shop" ? color.accentInk : color.ink

/*
 * React Email builds the padding out of table cells so the hit area survives clients that ignore
 * padding on an anchor. Outlook still measures the label rather than the box, which the team has
 * accepted rather than carry a VML fallback in every template.
 */
const ButtonLink = ({
  children,
  fill,
  href,
  variant
}: Omit<EmailButtonProps, "spacing" | "variant"> & {
  readonly variant: Variant
  /** Fill the cell instead of shrinking to the label, so a pair meets in the middle. */
  readonly fill?: boolean
}) => (
  <Button
    className={[variant === "primary" ? "dk-btn" : "", fill ? "btn-fill" : ""].filter(Boolean).join(" ") || undefined}
    href={href}
    style={{
      backgroundColor: buttonBackground(variant),
      border: buttonBorder(variant),
      borderRadius: radius,
      boxSizing: "border-box",
      color: buttonInk(variant),
      display: fill ? "block" : "inline-block",
      fontFamily: font.body,
      fontSize: 15,
      fontWeight: 700,
      lineHeight: "18px",
      padding: fill ? "13px 12px" : "13px 28px",
      textAlign: "center",
      textDecoration: "none",
      width: fill ? "100%" : undefined
    }}
  >
    {children}
  </Button>
)

export const EmailButton = ({ children, href, spacing = 24, variant = "primary" }: EmailButtonProps) => (
  <Section className="px btn" style={{ padding: `${spacing}px ${gutter}px 0`, textAlign: "center" }}>
    <ButtonLink href={href} variant={variant}>
      {children}
    </ButtonLink>
  </Section>
)

/** A button that sits inside a pair, filling its half so only the gutter separates the two. */
export const PairedButton = ({ children, href, variant = "primary" }: Omit<EmailButtonProps, "spacing">) => (
  <ButtonLink fill href={href} variant={variant}>
    {children}
  </ButtonLink>
)

export type EmailButtonPairProps = {
  readonly children: ReactNode
  readonly spacing?: number
}

/*
 * Two actions of equal weight. They stack once the page goes fluid rather than shrink to a pair of
 * labels too narrow to read, which is the whole reason the halves carry the `stack` class.
 */
export const EmailButtonPair = ({ children, spacing = 24 }: EmailButtonPairProps) => (
  <Section className="px btn" style={{ padding: `${spacing}px ${gutter}px 0` }}>
    <Row>{children}</Row>
  </Section>
)

/** One half of a pair, sized so the two split the width evenly with a gutter between them. */
export const ButtonPairCell = ({
  children,
  side
}: {
  readonly children: ReactNode
  readonly side: "left" | "right"
}) => (
  <Column
    className="stack"
    style={{
      paddingLeft: side === "right" ? 6 : 0,
      paddingRight: side === "left" ? 6 : 0,
      textAlign: "center",
      width: "50%"
    }}
  >
    {children}
  </Column>
)
