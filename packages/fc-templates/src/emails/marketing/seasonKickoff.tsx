import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band, BandCopy } from "../components/Band.tsx"
import { CtaBand } from "../components/CtaBand.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { IconCards } from "../components/OptionCards.tsx"
import { ProductCards } from "../components/ProductCards.tsx"

const seasonUrl = "https://fencing.club/collections/season-restock"

const heroImage = {
  alt: "Two fencers facing off at the start of a session",
  src: "https://images.unsplash.com/photo-1648500128137-5d4210c9fe34?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

const shot = (photo: string) =>
  `https://images.unsplash.com/${photo}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=460&q=80&w=530`

export const seasonKickoff = defineTemplate({
  id: "marketing_season_kickoff",
  subject: () => "New season. Fresh kit.",
  render: (vars) => (
    <EmailDocument
      preview="Replace the gear that wore out last year and step on the strip ready to score."
      title="New season. Fresh kit."
    >
      <EmailHeader eyebrow="SEASON RESTOCK / 2026" />
      <MarketingHero
        chip="NEW SEASON / RESTOCK YOUR KIT"
        headline="New season. Fresh kit."
        image={heroImage}
        lead="The season starts now. Replace the gear that wore out last year (uniforms, body cords, bags, and footwork essentials) and step on the strip ready to score."
      >
        <EmailButton href={seasonUrl} spacing={14}>
          Shop the season restock
        </EmailButton>
      </MarketingHero>
      <Band align="center" heading="Check your bag before week one" headingSize={20} padding={28} tone="dark">
        <BandCopy tone="dark">
          Frayed cords and worn soles cost touches. Restock early and it ships before the season starts.
        </BandCopy>
      </Band>
      <Band heading="Restock by category" headingSize={24} kicker="WHAT FENCERS REPLACE FIRST">
        <IconCards
          items={[
            {
              href: "https://fencing.club/collections/uniforms",
              icon: "layers",
              sub: "Jackets, knickers and plastrons",
              title: "Uniforms"
            },
            {
              href: "https://fencing.club/collections/body-cords",
              icon: "zap",
              sub: "Foil, épée and sabre",
              title: "Body cords"
            },
            {
              href: "https://fencing.club/collections/bags",
              icon: "move",
              sub: "Rollers and backpacks",
              title: "Bags"
            },
            {
              href: "https://fencing.club/collections/socks",
              icon: "user",
              sub: "Knee-high and cushioned",
              title: "Socks"
            },
            {
              href: "https://fencing.club/collections/shoes",
              icon: "target",
              sub: "Lunge-ready soles",
              title: "Shoes"
            },
            {
              href: "https://fencing.club/collections/gloves",
              icon: "shield",
              sub: "Grip and washable",
              title: "Gloves"
            }
          ]}
          spacing={20}
        />
      </Band>
      <Band heading="Grab-and-go picks" headingSize={24} kicker="SEASON STARTERS" padding={36} tone="surface">
        <ProductCards
          items={[
            {
              badge: "RESTOCK PICK",
              href: "https://fencing.club/products/novus-350n-jacket",
              image: shot("photo-1648484859970-4bfa3acc96f2"),
              price: "$95",
              tag: "UNIFORMS",
              title: "Novus 350N Jacket"
            },
            {
              badge: "TEAM FAVORITE",
              href: "https://fencing.club/products/pro-foil-body-cord",
              image: shot("photo-1653638601173-63729980bfba"),
              price: "$34",
              tag: "BODY CORDS",
              title: "Pro Foil Body Cord"
            }
          ]}
        />
      </Band>
      <CtaBand
        headline="Restock. Suit up. Score."
        href={seasonUrl}
        kicker="NEW SEASON"
        label="Shop the new season"
        support="Everything you need for opening week. Ships fast, arrives before your first bout."
      />
      <MarketingFooter
        fine="You’re receiving this because you subscribed to Fencing Club season updates."
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(seasonKickoff)
