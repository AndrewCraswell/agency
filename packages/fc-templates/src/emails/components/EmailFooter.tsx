import { liquidExpression, liquidValue, type PathRef, Var } from "@repo/shopify-emails"
import type { CSSProperties, ReactNode } from "react"
import { Column, Img, Link, Row, Section } from "react-email"
import { BandLead } from "./Band.tsx"
import { facebookIcon, instagramIcon } from "./socialIcons.ts"
import { color, font, gutter, shopLinks } from "./tokens.ts"

/*
 * Transactional and marketing mail close differently: one explains that you bought something, the
 * other has to offer a way out. Everything else is shared, so both live here and differ only in the
 * two link rows and the sentence between them.
 */

const linkStyle = { color: color.inkSoft, textDecoration: "underline" } as const

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

/* A policy's URL is relative and the merchant can move it, so it is read rather than written down. */
const policyHref = (shop: ShopRef, policy: PolicyRef): string => `${liquidValue(shop.url)}${liquidValue(policy.url)}`

/* Labels stay as designed: a store's own policy titles are long and title-cased. */
const transactionalNav = (shop: ShopRef): readonly FooterLink[] => [
  { href: shopLinks.trackOrder, label: "Track order" },
  { href: policyHref(shop, shop.refund_policy), label: "Returns" },
  { href: policyHref(shop, shop.shipping_policy), label: "Shipping" },
  { href: shopLinks.contact, label: "Contact us" }
]

const marketingNav: readonly FooterLink[] = [
  { href: shopLinks.shop, label: "Shop" },
  { href: shopLinks.trackOrder, label: "Track order" },
  { href: shopLinks.contact, label: "Contact us" }
]

const legalNav = (shop: ShopRef): readonly FooterLink[] => [
  { href: policyHref(shop, shop.privacy_policy), label: "Privacy policy" },
  { href: policyHref(shop, shop.terms_of_service), label: "Terms of service" }
]

type LinkRowProps = { readonly cellStyle: CSSProperties; readonly links: readonly FooterLink[] }

const LinkRow = ({ cellStyle, links }: LinkRowProps) => (
  <Row style={{ margin: "8px auto 0", width: "auto" }}>
    {links.map((link) => (
      <Column className="dk-muted" key={link.href} style={cellStyle}>
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

type PolicyRef = { readonly url: PathRef<string> }

/*
 * Only the shop drop is asked for, rather than a rendered address and name, so the footer states
 * the store's identity the same way in every message and a template cannot get it subtly wrong.
 */
export type ShopRef = {
  readonly name: PathRef<string>
  readonly privacy_policy: PolicyRef
  readonly refund_policy: PolicyRef
  readonly shipping_policy: PolicyRef
  readonly terms_of_service: PolicyRef
  /** Absolute, unlike a policy's own URL. */
  readonly url: PathRef<string>
  readonly address: {
    readonly address1: PathRef<string>
    readonly city: PathRef<string>
    readonly province: PathRef<string>
    readonly zip: PathRef<string>
  }
}

type FooterShellProps = {
  readonly fine: ReactNode
  readonly flush: boolean
  readonly legal: readonly FooterLink[]
  readonly nav: readonly FooterLink[]
  readonly shop: ShopRef
}

const FooterShell = ({ fine, flush, legal, nav, shop }: FooterShellProps) => (
  <BandLead flush={flush}>
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
  </BandLead>
)

export type EmailFooterProps = {
  /** Set where a band already closes the message, so the white gap does not read as a cut edge. */
  readonly flush?: boolean
  readonly shop: ShopRef
}

export const EmailFooter = ({ flush = false, shop }: EmailFooterProps) => (
  <FooterShell
    fine="You’re receiving this email because you placed an order or created an account with Fencing Club."
    flush={flush}
    legal={legalNav(shop)}
    nav={transactionalNav(shop)}
    shop={shop}
  />
)

export type MarketingFooterProps = EmailFooterProps & {
  /** Marketing mail has to offer a way out, so this is required rather than optional. */
  readonly unsubscribeUrl: string
  /** Why this reader is hearing from us, where a campaign can say it more precisely than the default. */
  readonly fine?: ReactNode
}

export const MarketingFooter = ({ fine, flush = false, shop, unsubscribeUrl }: MarketingFooterProps) => (
  <FooterShell
    fine={fine ?? "You’re receiving this email because you subscribed to updates from Fencing Club."}
    flush={flush}
    legal={[
      { href: unsubscribeUrl, label: "Unsubscribe" },
      { href: shopLinks.preferences, label: "Manage preferences" },
      ...legalNav(shop)
    ]}
    nav={marketingNav}
    shop={shop}
  />
)
