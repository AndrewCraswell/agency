import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { CtaBand } from "../components/CtaBand.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { ProductCards } from "../components/ProductCards.tsx"
import { QuickLinks } from "../components/QuickLinks.tsx"
import { CategoryStrip } from "../components/Strips.tsx"
import { shopLinks } from "../components/tokens.ts"

const heroImage = {
  alt: "New blades laid out on the armory bench",
  src: "https://images.unsplash.com/photo-1779831910458-f0419b4cba3c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

const shot = (photo: string) =>
  `https://images.unsplash.com/${photo}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=460&q=80&w=530`

export const newArrivals = defineTemplate({
  id: "marketing_new_arrivals",
  subject: () => "Just landed: this week’s new arrivals",
  render: (vars) => (
    <EmailDocument
      preview="New blades, masks, shoes and club gear just landed in the shop."
      title="Fresh off the strip"
    >
      <EmailHeader eyebrow="NEW ARRIVALS" />
      <MarketingHero
        chip="JUST LANDED"
        headline="Fresh off the strip."
        image={heroImage}
        lead="New blades, masks, shoes and club gear just landed in the shop, hand-picked and ready for your next bout."
      >
        <EmailButton href={shopLinks.shop} spacing={14}>
          Browse new arrivals
        </EmailButton>
      </MarketingHero>
      <CategoryStrip items={["WEAPONS", "UNIFORMS", "MASKS", "FOOTWEAR", "BAGS"]} />
      <Band heading="Six things worth a look." headingSize={24} kicker="THIS WEEK’S DROP">
        <ProductCards
          items={[
            {
              badge: "NEW",
              href: "https://fencing.club/products/apex-fie-foil-blade",
              image: shot("photo-1631529335371-c7eb1bc35b51"),
              price: "$79",
              tag: "FOILS",
              title: "Apex FIE Foil Blade"
            },
            {
              badge: "NEW",
              href: "https://fencing.club/products/vantage-fie-mask",
              image: shot("photo-1759417453067-7089de57d422"),
              price: "$145",
              tag: "MASKS",
              title: "Vantage FIE Mask"
            }
          ]}
        />
        <ProductCards
          items={[
            {
              badge: "NEW",
              href: "https://fencing.club/products/velocity-pro-shoes",
              image: shot("photo-1783434423802-e6a4b4082727"),
              price: "$129",
              tag: "FOOTWEAR",
              title: "Velocity Pro Shoes"
            },
            {
              badge: "NEW",
              href: "https://fencing.club/products/tour-roller-bag",
              image: shot("photo-1670103589082-c4eab5f588f4"),
              price: "$189",
              tag: "BAGS",
              title: "Tour Roller Bag"
            }
          ]}
          spacing={22}
        />
        <ProductCards
          items={[
            {
              badge: "NEW",
              href: "https://fencing.club/products/grip-pro-glove",
              image: shot("photo-1648484860115-906abc06a59a"),
              price: "$34",
              tag: "GLOVES",
              title: "Grip Pro Glove"
            },
            {
              badge: "NEW",
              href: "https://fencing.club/products/circuit-foil-lame",
              image: shot("photo-1648484859987-0da8b9d58a80"),
              price: "$159",
              tag: "LAMÉS",
              title: "Circuit Foil Lamé"
            }
          ]}
          spacing={22}
        />
      </Band>
      <CtaBand
        headline="See everything that just landed."
        href={shopLinks.shop}
        kicker="NEW EVERY WEEK"
        label="Shop all new arrivals"
        support="Fresh blades, masks, footwear and club gear are added to the shop every week. Get first pick."
      />
      <QuickLinks />
      <MarketingFooter
        fine="You’re receiving this because you subscribed to Fencing Club updates about new gear."
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(newArrivals)
