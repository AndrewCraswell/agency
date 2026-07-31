import { liquidExpression, type PathRef, Var } from "@repo/shopify-emails"
import type { CSSProperties, ReactNode } from "react"
import { Column, Img, Link, Row, Section } from "react-email"
import { facebookIcon, instagramIcon } from "./socialIcons.ts"
import { color, font, gutter, shopLinks } from "./tokens.ts"

/*
 * Transactional and marketing mail close differently: one explains that you bought something, the
 * other has to offer a way out. Everything else is shared, so both live here and differ only in the
 * two link rows and the sentence between them.
 */

const linkStyle = { color: color.inkSoft, textDecoration: "none" } as const

const navCellStyle = {
  color: color.inkSoft,
  fontFamily: font.body,
  fontSize: 12,
  lineHeight: "18px",
  padding: "4px 8px"
} as const

const legalCellStyle = { ...navCellStyle, fontSize: 11 } as const

const fineStyle = {
  color: color.inkSoft,
  fontFamily: font.body,
  fontSize: 11,
  fontWeight: 400,
  lineHeight: "17px"
} as const

type FooterLink = { readonly href: string; readonly label: string }

const transactionalNav: readonly FooterLink[] = [
  { href: shopLinks.trackOrder, label: "Track order" },
  { href: shopLinks.returns, label: "Returns" },
  { href: shopLinks.shipping, label: "Shipping" },
  { href: shopLinks.contact, label: "Contact us" }
]

const marketingNav: readonly FooterLink[] = [
  { href: shopLinks.shop, label: "Shop" },
  { href: shopLinks.trackOrder, label: "Track order" },
  { href: shopLinks.contact, label: "Contact us" }
]

const legalNav: readonly FooterLink[] = [
  { href: shopLinks.privacy, label: "Privacy policy" },
  { href: shopLinks.terms, label: "Terms of service" }
]

type LinkRowProps = { readonly cellStyle: CSSProperties; readonly links: readonly FooterLink[] }

const LinkRow = ({ cellStyle, links }: LinkRowProps) => (
  <Row style={{ margin: "8px auto 0", width: "auto" }}>
    {links.map((link) => (
      <Column className="dk-muted" key={link.label} style={cellStyle}>
        <Link href={link.href} style={linkStyle}>
          {link.label}
        </Link>
      </Column>
    ))}
  </Row>
)

const socials = [
  { alt: "Instagram", href: shopLinks.instagram, src: instagramIcon },
  { alt: "Facebook", href: shopLinks.facebook, src: facebookIcon }
] as const

const SocialRow = () => (
  <Row style={{ margin: "12px auto 0", width: "auto" }}>
    {socials.map((social) => (
      <Column key={social.alt} style={{ padding: "0 5px" }}>
        <Link href={social.href}>
          <Img
            alt={social.alt}
            height={30}
            src={social.src}
            style={{ borderRadius: 15, display: "block" }}
            width={30}
          />
        </Link>
      </Column>
    ))}
  </Row>
)

/*
 * Only the shop drop is asked for, rather than a rendered address and name, so the footer states
 * the store's identity the same way in every message and a template cannot get it subtly wrong.
 */
export type ShopRef = {
  readonly name: PathRef<string>
  readonly address: {
    readonly address1: PathRef<string>
    readonly city: PathRef<string>
    readonly province: PathRef<string>
    readonly zip: PathRef<string>
  }
}

type FooterShellProps = {
  readonly fine: ReactNode
  readonly legal: readonly FooterLink[]
  readonly nav: readonly FooterLink[]
  readonly shop: ShopRef
}

const FooterShell = ({ fine, legal, nav, shop }: FooterShellProps) => (
  <Section
    className="px dk-surface"
    style={{ backgroundColor: color.surface, padding: `28px ${gutter}px`, textAlign: "center" }}
  >
    <div
      className="dk-muted"
      style={{
        color: color.inkSoft,
        fontFamily: font.body,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        lineHeight: "16px"
      }}
    >
      FENCING CLUB
    </div>
    <div className="dk-muted" style={{ ...fineStyle, fontSize: 11.5, lineHeight: "18px", paddingTop: 6 }}>
      <Var path={shop.address.address1} />, <Var path={shop.address.city} />, <Var path={shop.address.province} />{" "}
      <Var path={shop.address.zip} />
    </div>
    <LinkRow cellStyle={navCellStyle} links={nav} />
    <div className="dk-muted appleLinks" style={{ ...fineStyle, margin: "8px auto 0", maxWidth: 460 }}>
      {fine}
    </div>
    <LinkRow cellStyle={legalCellStyle} links={legal} />
    <SocialRow />
    <div className="dk-muted" style={{ ...fineStyle, paddingTop: 12 }}>
      © {liquidExpression("'now' | date: '%Y'")} <Var path={shop.name} />. All rights reserved.
    </div>
  </Section>
)

export type EmailFooterProps = {
  readonly shop: ShopRef
}

export const EmailFooter = ({ shop }: EmailFooterProps) => (
  <FooterShell
    fine="You’re receiving this email because you placed an order or created an account with Fencing Club."
    legal={legalNav}
    nav={transactionalNav}
    shop={shop}
  />
)

export type MarketingFooterProps = EmailFooterProps & {
  /** Marketing mail has to offer a way out, so this is required rather than optional. */
  readonly unsubscribeUrl: string
  /** Why this reader is hearing from us, where a campaign can say it more precisely than the default. */
  readonly fine?: ReactNode
}

export const MarketingFooter = ({ fine, shop, unsubscribeUrl }: MarketingFooterProps) => (
  <FooterShell
    fine={fine ?? "You’re receiving this email because you subscribed to updates from Fencing Club."}
    legal={[
      { href: unsubscribeUrl, label: "Unsubscribe" },
      { href: shopLinks.preferences, label: "Manage preferences" },
      ...legalNav
    ]}
    nav={marketingNav}
    shop={shop}
  />
)
