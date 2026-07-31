import type { ReactNode } from "react"
import { Img, Section } from "react-email"
import { IconChip } from "./FeatureList.tsx"
import type { LineIconName } from "./lineIcons.ts"
import { color, font, gutter, radius } from "./tokens.ts"

/** The red pill is what the design reserves for a last reminder, so it cannot be the default. */
export type ChipTone = "ink" | "urgent" | "positive" | "quiet" | "translucent"

export type MarketingChipProps = {
  readonly children: ReactNode
  readonly tone?: ChipTone
}

const chipBackground: Record<ChipTone, string> = {
  ink: color.accent,
  positive: color.paid,
  quiet: color.surface,
  translucent: "rgba(255, 255, 255, 0.1)",
  urgent: color.focus
}

const chipInk: Record<ChipTone, string> = {
  ink: color.onDark,
  positive: color.onDark,
  quiet: color.ink,
  translucent: color.onDark,
  urgent: color.onDark
}

const darkChipClass: Record<ChipTone, string | undefined> = {
  ink: "dk-chip",
  positive: undefined,
  quiet: "dk-surface dk-text",
  translucent: undefined,
  urgent: undefined
}

/*
 * The small dark pill above a marketing headline. It is a bordered span rather than a table cell
 * because it has to shrink to its label, and a cell in a centred section will not.
 */
export const MarketingChip = ({ children, tone = "ink" }: MarketingChipProps) => (
  <span
    /* Only the pills that sit on a page need a dark-scheme counterpart. */
    className={darkChipClass[tone]}
    style={{
      backgroundColor: chipBackground[tone],
      borderRadius: 20,
      color: chipInk[tone],
      display: "inline-block",
      fontFamily: font.body,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: 1.5,
      lineHeight: "14px",
      padding: "5px 12px"
    }}
  >
    {children}
  </span>
)

export type MarketingHeroProps = {
  readonly chip?: string
  readonly chipTone?: ChipTone
  /** A glyph above the headline, for the emails that lead with a condition rather than a product. */
  readonly icon?: LineIconName
  /** The small caps line between the chip and the headline, where a launch names the category. */
  readonly kicker?: string
  readonly headline: ReactNode
  readonly lead?: ReactNode
  /** The call to action, which sits between the copy and the picture. */
  readonly children?: ReactNode
  readonly image?: { readonly src: string; readonly alt: string }
  /** A hero on a dark band inverts its type but keeps the same measure. */
  readonly tone?: "page" | "dark"
}

export const MarketingHero = ({
  children,
  chip,
  chipTone,
  headline,
  icon,
  image,
  kicker,
  lead,
  tone = "page"
}: MarketingHeroProps) => {
  const dark = tone === "dark"
  return (
    <Section
      className={dark ? "px dk-band" : "px"}
      style={{
        backgroundColor: dark ? color.surfaceDark : color.bg,
        padding: `${chip === undefined && icon === undefined ? 40 : 36}px ${gutter}px 28px`,
        textAlign: "center"
      }}
    >
      {icon !== undefined && (
        <Section style={{ paddingBottom: 4 }}>
          <IconChip name={icon} tone="surface" />
        </Section>
      )}
      {chip !== undefined && <MarketingChip tone={chipTone}>{chip}</MarketingChip>}
      {kicker !== undefined && (
        <div
          className={dark ? undefined : "dk-muted"}
          style={{
            color: dark ? color.onDarkSoft : color.inkSoft,
            fontFamily: font.display,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 2.2,
            lineHeight: "16px",
            paddingTop: chip === undefined ? 0 : 16
          }}
        >
          {kicker}
        </div>
      )}
      <h1
        className={dark ? "h1-lg" : "h1-lg dk-text"}
        style={{
          color: dark ? color.onDark : color.ink,
          fontFamily: font.display,
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: -1,
          lineHeight: "40px",
          margin: `${chip === undefined && icon === undefined && kicker === undefined ? 0 : 14}px 0 0`
        }}
      >
        {headline}
      </h1>
      {lead !== undefined && (
        <div
          className={dark ? "sub" : "sub dk-muted"}
          style={{
            color: dark ? color.onDarkSoft : color.inkSoft,
            fontFamily: font.body,
            fontSize: 15,
            fontWeight: 400,
            lineHeight: "24px",
            margin: "14px auto 0",
            maxWidth: 500
          }}
        >
          {lead}
        </div>
      )}
      {children}
      {image !== undefined && (
        <Img
          alt={image.alt}
          className="fluid"
          height={340}
          src={image.src}
          style={{ borderRadius: radius, marginTop: 14, objectFit: "cover", width: "100%" }}
          width={536}
        />
      )}
    </Section>
  )
}
