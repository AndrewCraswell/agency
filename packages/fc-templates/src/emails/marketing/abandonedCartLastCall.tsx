import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { CartLines } from "../components/CartLines.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { OfferBand } from "../components/OfferBand.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

/** The last chase, and the only one that spends margin. Nothing follows it, so it says so. */
export const abandonedCartLastCall = defineTemplate({
  id: "marketing_abandoned_cart_last_call",
  type: "abandonment",
  subject: () => "Don’t miss out on 5% off your entire cart",
  render: (vars) => (
    <EmailDocument preview="Last call. Here’s 5% off the items you left behind." title="Still thinking it over?">
      <EmailHeader eyebrow="YOUR CART" />
      <MarketingHero
        chip="LAST CALL"
        chipTone="urgent"
        headline="Still thinking it over?"
        lead="Here’s 5% off your entire cart to help you make up your mind. This is the last reminder we’ll send about these items."
      >
        <EmailButton href={liquidValue(vars.abandoned_visit.url)} spacing={14}>
          Redeem discount
        </EmailButton>
      </MarketingHero>
      <OfferBand code="CART5" figure="5%" flush label="Off your entire cart" note="at checkout / expires in 14 days" />
      <Band heading="Your cart, one more time" headingSize={22} kicker="LAST CHANCE" padding={36} tone="surface">
        <CartLines
          lines={vars.abandoned_visit.products_added_to_cart}
          remaining={vars.abandoned_visit.remaining_cart_products_count}
        />
      </Band>
      <SupportBand flush heading="We’ll help you get the right kit.">
        Tell us your weapon, level, and size, and we’ll confirm the right choice before you spend anything.
      </SupportBand>
      <MarketingFooter
        fine="You’re receiving this because you started an order at fencing.club. Discounts can’t be combined, so the largest one is applied."
        flush
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(abandonedCartLastCall)
