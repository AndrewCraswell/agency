import { Column, Link, Row, Section } from "react-email"
import { color, font, gutter, sectionGap } from "./tokens.ts"

/*
 * The chip row that gives a reader somewhere to go when the message itself has no action left.
 * Two rows of three rather than one wrapping row, because a wrapped inline list is not something an
 * email client can be relied on to lay out.
 */

const collections = [
  [
    { href: "https://fencing.club/collections/weapons", label: "Weapons" },
    { href: "https://fencing.club/collections/blades", label: "Blades" },
    { href: "https://fencing.club/collections/masks", label: "Masks" }
  ],
  [
    { href: "https://fencing.club/collections/jackets", label: "Jackets" },
    { href: "https://fencing.club/collections/gloves-and-shoes", label: "Gloves & Shoes" },
    { href: "https://fencing.club/collections/club-gear", label: "Club Gear" }
  ]
] as const

const chipStyle = {
  border: `1px solid ${color.line}`,
  borderRadius: 999,
  color: color.ink,
  display: "inline-block",
  fontFamily: font.body,
  fontSize: 12,
  fontWeight: 600,
  lineHeight: "16px",
  padding: "9px 16px",
  textDecoration: "none"
} as const

export type QuickLinksProps = {
  /** The line above the chips, which changes with why the email is offering them. */
  readonly kicker?: string
  readonly tone?: "page" | "surface"
}

export const QuickLinks = ({ kicker = "WHILE YOU’RE HERE", tone = "page" }: QuickLinksProps) => (
  <Section
    className={tone === "page" ? "px" : "px dk-surface"}
    style={{
      backgroundColor: tone === "page" ? color.bg : color.surface,
      padding: `${sectionGap}px ${gutter}px 0`
    }}
  >
    <div
      className="dk-muted"
      style={{
        color: color.inkSoft,
        fontFamily: font.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.4,
        lineHeight: "16px",
        paddingBottom: 10
      }}
    >
      {kicker}
    </div>
    {collections.map((row) => (
      <Row align="left" key={row[0].label} style={{ marginBottom: 10, width: "auto" }}>
        {row.map((chip) => (
          <Column key={chip.label} style={{ paddingRight: 10 }}>
            <Link className="dk-border dk-text" href={chip.href} style={chipStyle}>
              {chip.label}
            </Link>
          </Column>
        ))}
      </Row>
    ))}
  </Section>
)
