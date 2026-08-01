import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band, BandCopy } from "../components/Band.tsx"
import { CartLines } from "../components/CartLines.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

/** The first chase, sent while the cart is fresh. It leans on scarcity rather than on a discount. */
export const abandonedCartReminder = defineTemplate({
  id: "marketing_abandoned_cart_reminder",
  type: "abandonment",
  subject: () => "Items in your cart are selling out fast",
  render: (vars) => (
    <EmailDocument
      preview="There are items in your cart that can sell out fast. Get them before they’re gone."
      title="You left something behind"
    >
      <EmailHeader eyebrow="YOUR CART" />
      <MarketingHero
        chip="STILL IN YOUR CART"
        headline="You left something behind."
        lead="We saved the items you added. Fencing gear moves quickly, so finish up while your sizes are still in stock."
      >
        <EmailButton href={liquidValue(vars.abandoned_visit.url)} spacing={14}>
          Complete your order
        </EmailButton>
      </MarketingHero>
      <Band heading="Ready when you are" headingSize={22} kicker="IN YOUR CART" padding={36} tone="surface">
        <CartLines
          lines={vars.abandoned_visit.products_added_to_cart}
          remaining={vars.abandoned_visit.remaining_cart_products_count}
        />
      </Band>
      <Band align="center" heading="A cart is not a reservation." headingSize={26} padding={36} tone="dark">
        <BandCopy tone="dark">
          Items stay available to everyone until an order is placed. Popular sizes and blade grades are usually the
          first to go.
        </BandCopy>
      </Band>
      <SupportBand flush>
        Sizing, blade grades, or club orders. Tell us what you fence and we’ll point you at the right kit.
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

export default definePreview(abandonedCartReminder)
