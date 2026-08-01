import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { ProductCards } from "../components/ProductCards.tsx"
import { FeaturedProduct } from "../components/ProductFeature.tsx"
import { QuickLinks } from "../components/QuickLinks.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

const shot = (photo: string, width: number, height: number) =>
  `https://images.unsplash.com/${photo}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=${height}&q=80&w=${width}`

export const backInStock = defineTemplate({
  id: "marketing_back_in_stock",
  subject: () => "It’s back: the Elite FIE 1600N Mask",
  render: (vars) => (
    <EmailDocument preview="Only a limited run came back, and it went fast last time." title="Back in stock">
      <EmailHeader eyebrow="BACK IN STOCK" />
      <MarketingHero
        chip="BACK IN STOCK"
        chipTone="positive"
        headline="It’s back."
        lead="The mask you had your eye on is available again. We restocked a limited run of the Elite FIE 1600N Mask."
      >
        <FeaturedProduct
          action="Buy it now"
          badge="IN STOCK"
          facts={["Size Large"]}
          href="https://fencing.club/products/elite-fie-1600n-mask"
          image={shot("photo-1648500128138-53b62cbb1cf8", 1024, 520)}
          price="$189"
          tag="MASKS / SABRE"
          title="Elite FIE 1600N Mask"
          urgency="Only 8 left. They sold out fast last time."
        />
      </MarketingHero>
      <Band heading="Back on the rack" headingSize={24} kicker="ALSO RESTOCKED" padding={36} tone="surface">
        <ProductCards
          items={[
            {
              href: "https://fencing.club/products/foil-mask",
              image: shot("photo-1759417453067-7089de57d422", 400, 352),
              price: "$179",
              sub: "In stock",
              tag: "MASKS",
              title: "Foil Mask"
            },
            {
              href: "https://fencing.club/products/800n-jacket",
              image: shot("photo-1648484859970-4bfa3acc96f2", 400, 352),
              price: "$149",
              sub: "In stock",
              tag: "JACKETS",
              title: "800N Jacket"
            },
            {
              href: "https://fencing.club/products/leather-glove",
              image: shot("photo-1648484860115-906abc06a59a", 400, 352),
              price: "$39",
              sub: "In stock",
              tag: "GLOVES",
              title: "Leather Glove"
            }
          ]}
        />
      </Band>
      <QuickLinks />
      <SupportBand flush>
        Not quite what you were after? Tell us what you fence and we’ll let you know the moment it lands.
      </SupportBand>
      <MarketingFooter
        fine="You’re receiving this because you asked to be told when this item came back."
        flush
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(backInStock)
