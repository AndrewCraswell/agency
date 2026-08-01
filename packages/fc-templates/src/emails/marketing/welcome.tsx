import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band, BandCopy } from "../components/Band.tsx"
import { CtaBand } from "../components/CtaBand.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { FeatureList } from "../components/FeatureList.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { OfferBand } from "../components/OfferBand.tsx"
import { shopLinks } from "../components/tokens.ts"

const heroImage = {
  alt: "A fencer on the strip, mask down, mid-lunge",
  src: "https://images.unsplash.com/photo-1729166240836-4850b7b257ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

export const welcome = defineTemplate({
  id: "marketing_welcome",
  subject: () => "Welcome to Fencing Club — here’s 10% off",
  render: (vars) => (
    <EmailDocument
      preview="A fencing-only shop, run by fencers. Take 10% off your first order."
      title="Welcome to the Club"
    >
      <EmailHeader eyebrow="WELCOME / NEW SUBSCRIBER" />
      <MarketingHero
        chip="WELCOME TO THE CLUB"
        headline="Welcome to the Club!"
        image={heroImage}
        lead="Thanks for joining fencers who take the sport seriously. We’re a fencing-only shop: foils, épées, sabres, blades, masks, jackets and everything the strip demands, chosen and checked by people who actually fence."
      >
        <EmailButton href={shopLinks.shop} spacing={14}>
          Shop the collection
        </EmailButton>
      </MarketingHero>
      <OfferBand code="WELCOME10" figure="10%" flush label="Off your first order" note="at checkout / valid 14 days" />
      <Band heading="Fencing is all we do." kicker="OUR STORY">
        <BandCopy>
          Fencing Club started in 2023 with one idea: a shop run by fencers, for fencers. No generic sporting-goods
          clutter, just competition-grade weapons and kit, curated for club nights, tournaments and everything in
          between.
        </BandCopy>
        <BandCopy>
          Every order passes through our in-house armory before it ships. If it’s not something we’d trust on the strip
          ourselves, we don’t sell it.
        </BandCopy>
      </Band>
      <Band
        heading="Certified gear. Real expertise."
        headingSize={24}
        kicker="WHY FENCERS TRUST US"
        padding={36}
        tone="surface"
      >
        <FeatureList
          items={[
            {
              body: "Competition weapons and lamés meet FIE and national safety standards, ready for sanctioned events.",
              icon: "shieldCheck",
              title: "FIE-certified equipment"
            },
            {
              body: "We stock genuine gear from the brands fencers know, sourced through official distribution, never grey-market.",
              icon: "badgeCheck",
              title: "Authorized brand partner"
            },
            {
              body: "Our armorers assemble, wire and pressure-test weapons before they ship, so your kit arrives strip-ready.",
              icon: "wrench",
              title: "Expert in-house armory"
            }
          ]}
        />
      </Band>
      <CtaBand
        headline="Gear up for your first bout."
        href={shopLinks.shop}
        kicker="START HERE"
        label="Shop with WELCOME10"
        support="Your 10% welcome discount is waiting. Browse weapons, kit and club essentials in one place."
      />
      <MarketingFooter
        fine="You’re receiving this because you just subscribed to Fencing Club. Welcome aboard!"
        flush
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(welcome)
