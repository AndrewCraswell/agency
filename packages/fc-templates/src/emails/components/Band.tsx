import type { ReactNode } from "react"
import { Section } from "react-email"
import { bandGap, color, font, gutter } from "./tokens.ts"

export type BandLeadProps = {
  /** Set where the band above already has a colour, so the white gap does not read as a cut edge. */
  readonly flush?: boolean
  readonly children: ReactNode
}

/** The white space a band sits below, held by a wrapper because the band's own table is tinted. */
export const BandLead = ({ children, flush = false }: BandLeadProps) => (
  <Section style={{ backgroundColor: color.bg, padding: flush ? 0 : `${bandGap}px 0 0` }}>{children}</Section>
)

export type BandTone = "page" | "surface" | "dark"

export type BandProps = {
  readonly children: ReactNode
  readonly heading?: ReactNode
  /** The size the design draws the heading at, which changes with how much the band has to carry. */
  readonly headingSize?: number
  readonly kicker?: string
  readonly tone?: BandTone
  readonly align?: "left" | "center"
  readonly padding?: number
}

const bandBackground: Record<BandTone, string> = {
  dark: color.surfaceDark,
  page: color.bg,
  surface: color.surface
}

const bandClass: Record<BandTone, string> = {
  dark: "px dk-band",
  page: "px",
  surface: "px dk-surface"
}

/*
 * A horizontal stripe of the email: a background, the shared gutter, and an optional kicker and
 * heading above whatever the section holds. Stacking these is what gives a marketing email its
 * rhythm, so the tone is the only thing a template picks.
 */
export const Band = ({
  align = "left",
  children,
  heading,
  headingSize = 28,
  kicker,
  padding = 40,
  tone = "page"
}: BandProps) => {
  const dark = tone === "dark"
  return (
    <Section
      className={bandClass[tone]}
      style={{ backgroundColor: bandBackground[tone], padding: `${padding}px ${gutter}px`, textAlign: align }}
    >
      {kicker !== undefined && (
        <div
          className={dark ? undefined : "dk-muted"}
          style={{
            color: dark ? color.onDarkSoft : color.inkSoft,
            fontFamily: font.display,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 2.2,
            lineHeight: "16px"
          }}
        >
          {kicker}
        </div>
      )}
      {heading !== undefined && (
        <div
          className={dark ? undefined : "dk-text"}
          style={{
            color: dark ? color.onDark : color.ink,
            fontFamily: font.display,
            fontSize: headingSize,
            fontWeight: 700,
            letterSpacing: -0.4,
            lineHeight: `${Math.round(headingSize * 1.15)}px`,
            paddingTop: kicker === undefined ? 0 : 10
          }}
        >
          {heading}
        </div>
      )}
      {children}
    </Section>
  )
}

export type BandCopyProps = {
  readonly children: ReactNode
  /** Matches the tone of the band it sits in, which decides whether the copy is light or dark. */
  readonly tone?: BandTone
}

/** A paragraph inside a band, at the measure the design sets for running copy. */
export const BandCopy = ({ children, tone = "page" }: BandCopyProps) => {
  const dark = tone === "dark"
  return (
    <div
      className={dark ? undefined : "dk-muted"}
      style={{
        color: dark ? color.onDarkSoft : color.inkSoft,
        fontFamily: font.body,
        fontSize: 14,
        fontWeight: 400,
        lineHeight: "22px",
        paddingTop: 14
      }}
    >
      {children}
    </div>
  )
}
