import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { CtaBand } from "../components/CtaBand.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { MediaRows } from "../components/MediaRows.tsx"
import { SpecStrip, SplitCallout } from "../components/Strips.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

const productUrl = "https://fencing.club/products/vanta-blade"

const heroImage = {
  alt: "The Vanta blade against a dark backdrop",
  src: "https://images.unsplash.com/photo-1648484859987-0da8b9d58a80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

const shot = (photo: string) =>
  `https://images.unsplash.com/${photo}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=184&q=80&w=232`

export const productLaunch = defineTemplate({
  id: "marketing_product_launch",
  subject: () => "Introducing the Vanta Blade",
  render: (vars) => (
    <EmailDocument preview="A maraging-steel FIE competition blade, in a limited first run." title="The Vanta Blade">
      <EmailHeader eyebrow="PRODUCT LAUNCH" />
      <MarketingHero
        chip="THE DROP / LIMITED FIRST RUN"
        headline="The Vanta Blade."
        image={heroImage}
        kicker="INTRODUCING"
        lead="A maraging-steel FIE competition blade engineered for speed, balance and a lifetime of ripostes."
        tone="dark"
      />
      <SpecStrip
        items={[
          { label: "Certified 800N", value: "FIE" },
          { label: "Balanced weight", value: "110g" },
          { label: "Steel alloy", value: "Maraging" },
          { label: "Blade warranty", value: "2 yr" }
        ]}
      />
      <Band heading="Three reasons it hits different." headingSize={24} kicker="WHY THE VANTA" padding={36}>
        <MediaRows
          items={[
            {
              body: "Maraging steel returns to true instantly after every bind and beat: no wobble, no lag.",
              image: shot("photo-1648500128065-2f67c752ed36"),
              title: "Whip-fast recovery"
            },
            {
              body: "A re-tuned centre of gravity sits closer to the guard, so the tip feels weightless in the hand.",
              image: shot("photo-1648484859970-4bfa3acc96f2"),
              title: "Feather-balanced"
            },
            {
              body: "Rigorously fatigue-tested and backed by a full 2-year blade warranty against breakage.",
              image: shot("photo-1653638601173-63729980bfba"),
              title: "Built to last"
            }
          ]}
        />
      </Band>
      <SplitCallout figure="$149" kicker="LIMITED FIRST RUN" spacing={4} unit="per blade">
        Only 200 blades in the first batch, shipping this week.
      </SplitCallout>
      <CtaBand
        headline="Claim yours before it’s gone."
        href={productUrl}
        kicker="THE VANTA BLADE"
        label="Claim the Vanta"
        support="First-run blades ship in the order they’re claimed. When they’re gone, they’re gone until the next batch."
      />
      <SupportBand flush heading="Questions about the blade?">
        Our armory team can talk you through grades, grips and what suits the way you fence.
      </SupportBand>
      <MarketingFooter
        fine="You’re receiving this because you subscribed to Fencing Club updates about product launches."
        flush
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(productLaunch)
