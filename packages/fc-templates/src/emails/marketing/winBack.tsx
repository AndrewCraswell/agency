import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band, BandCopy } from "../components/Band.tsx"
import { CtaBand } from "../components/CtaBand.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { OfferBand } from "../components/OfferBand.tsx"
import { ProductCards } from "../components/ProductCards.tsx"
import { QuickLinks } from "../components/QuickLinks.tsx"
import { shopLinks } from "../components/tokens.ts"

const heroImage = {
  alt: "An empty piste waiting at the start of a session",
  src: "https://images.unsplash.com/photo-1648500128065-2f67c752ed36?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

const shot = (photo: string) =>
  `https://images.unsplash.com/${photo}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=460&q=80&w=530`

export const winBack = defineTemplate({
  id: "marketing_win_back",
  subject: () => "We miss you on the strip — here’s $10 off",
  render: (vars) => (
    <EmailDocument
      preview="It’s been a while. Here’s $10 off to get you back en garde."
      title="We miss you on the strip"
    >
      <EmailHeader eyebrow="WE MISS YOU" />
      <MarketingHero
        chip="IT’S BEEN A WHILE"
        headline="We miss you on the strip."
        image={heroImage}
        lead="It’s been a while since your last order. Whether you took a break or your gear’s been gathering dust, here’s a little something to get you back en garde."
      >
        <EmailButton href={shopLinks.shop} spacing={14}>
          Come back for $10 off
        </EmailButton>
      </MarketingHero>
      <OfferBand code="WELCOMEBACK" figure="$10" flush label="Off your order" note="at checkout / valid 14 days" />
      <Band heading="The parts that wear out" headingSize={24} kicker="TIME TO REPLACE">
        <BandCopy>
          If you’ve been away, these are the first things to check. Broken blades and dead cords are the top reasons
          fencers can’t compete.
        </BandCopy>
        <ProductCards
          items={[
            {
              badge: "MOST REPLACED",
              href: "https://fencing.club/products/maraging-fie-blade",
              image: shot("photo-1653638601173-63729980bfba"),
              price: "$52",
              tag: "BLADES",
              title: "Maraging FIE Blade"
            },
            {
              badge: "QUICK FIX",
              href: "https://fencing.club/products/foil-point-assembly",
              image: shot("photo-1648484859987-0da8b9d58a80"),
              price: "$18",
              tag: "POINTS AND TIPS",
              title: "Foil Point Assembly"
            }
          ]}
        />
        <ProductCards
          items={[
            {
              badge: "STAPLE",
              href: "https://fencing.club/products/pro-body-cord",
              image: shot("photo-1631529335371-c7eb1bc35b51"),
              price: "$34",
              tag: "BODY CORDS",
              title: "Pro Body Cord"
            },
            {
              badge: "HANDY",
              href: "https://fencing.club/products/repair-parts-kit",
              image: shot("photo-1648484860115-906abc06a59a"),
              price: "$26",
              tag: "SPARE PARTS",
              title: "Repair Parts Kit"
            }
          ]}
          spacing={22}
        />
      </Band>
      <QuickLinks kicker="PICK UP WHERE YOU LEFT OFF" tone="surface" />
      <CtaBand
        headline="Let’s get you back en garde."
        href={shopLinks.shop}
        kicker="YOUR $10 IS WAITING"
        label="Redeem $10 off"
        support="Refresh your kit, use code WELCOMEBACK, and step back on the strip. We’ve kept your spot."
      />
      <MarketingFooter
        fine="You’re receiving this because you’ve shopped with Fencing Club before."
        flush
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(winBack)
