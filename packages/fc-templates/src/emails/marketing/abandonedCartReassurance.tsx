import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band, BandCopy } from "../components/Band.tsx"
import { CartLines } from "../components/CartLines.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { shopLinks } from "../components/tokens.ts"

/** The second chase. Nothing has expired, so it reassures rather than pushes. */
export const abandonedCartReassurance = defineTemplate({
  id: "marketing_abandoned_cart_reassurance",
  type: "abandonment",
  subject: () => "Everything’s still in your cart",
  render: (vars) => (
    <EmailDocument preview="You still have items left in your cart." title="Everything’s still here">
      <EmailHeader eyebrow="YOUR CART" />
      <MarketingHero
        chip="SAVED FOR YOU"
        headline="Everything’s still here."
        lead="Everything you picked is still here, exactly as you left it. Pick up where you stopped and we’ll get it moving."
      >
        <EmailButton href={liquidValue(vars.abandoned_visit.url)} spacing={14}>
          Complete order
        </EmailButton>
      </MarketingHero>
      <Band heading="Exactly as you left it" headingSize={22} kicker="STILL SAVED" padding={36} tone="surface">
        <CartLines
          lines={vars.abandoned_visit.products_added_to_cart}
          remaining={vars.abandoned_visit.remaining_cart_products_count}
        />
      </Band>
      <Band align="center" heading="Gear chosen by people who fence." headingSize={26} padding={36} tone="dark">
        <BandCopy tone="dark">
          We stock what we would take to a tournament ourselves, from beginner kit to competition blades. No generic
          sporting-goods filler.
        </BandCopy>
      </Band>
      <SupportBand flush heading="Most answers are already in our FAQ." href={shopLinks.faq} label="Read the FAQ">
        Shipping, sizing, and returns are all covered there. If yours isn’t, our team will sort it out for you.
      </SupportBand>
      <MarketingFooter
        fine="You’re receiving this because you started an order at fencing.club."
        flush
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(abandonedCartReassurance)
