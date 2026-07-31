import type { ReactNode } from "react"
import { Button, Section } from "react-email"
import { color, font, gutter, radius } from "./tokens.ts"

export type EmailButtonProps = {
  readonly href: string
  readonly children: ReactNode
  /** A second action beside the first reads as a choice; the quieter one is outlined. */
  readonly variant?: "primary" | "secondary" | "inverse"
  /** The gap above the button, which a tighter marketing stack sets smaller than a notification. */
  readonly spacing?: number
}

const buttonBackground: Record<NonNullable<EmailButtonProps["variant"]>, string> = {
  inverse: color.bg,
  primary: color.accent,
  secondary: "transparent"
}

/*
 * React Email builds the padding out of table cells so the hit area survives clients that ignore
 * padding on an anchor. Outlook still measures the label rather than the box, which the team has
 * accepted rather than carry a VML fallback in every template.
 */
export const EmailButton = ({ children, href, spacing = 24, variant = "primary" }: EmailButtonProps) => {
  const primary = variant === "primary"
  return (
    <Section className="px btn" style={{ padding: `${spacing}px ${gutter}px 0`, textAlign: "center" }}>
      <Button
        className={primary ? "dk-btn" : undefined}
        href={href}
        style={{
          backgroundColor: buttonBackground[variant],
          border: variant === "secondary" ? `1px solid ${color.line}` : "none",
          borderRadius: radius,
          color: primary ? color.accentInk : color.ink,
          fontFamily: font.body,
          fontSize: 15,
          fontWeight: 700,
          lineHeight: "18px",
          padding: "13px 28px",
          textDecoration: "none"
        }}
      >
        {children}
      </Button>
    </Section>
  )
}
