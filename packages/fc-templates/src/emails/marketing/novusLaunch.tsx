import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Img } from "react-email"
import { Band, BandCopy } from "../components/Band.tsx"
import { CtaBand } from "../components/CtaBand.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { FeatureList } from "../components/FeatureList.tsx"
import { HelpCard } from "../components/HelpCard.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { Tiles } from "../components/MediaRows.tsx"
import { ProductCards } from "../components/ProductCards.tsx"
import { color, font, radius } from "../components/tokens.ts"

const collectionUrl = "https://fencing.club/collections/novus"

const heroImage = {
  alt: "A fencer in a white club uniform, en garde",
  src: "https://images.unsplash.com/photo-1631529335371-c7eb1bc35b51?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

const shot = (photo: string, width: number, height: number) =>
  `https://images.unsplash.com/${photo}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=${height}&q=80&w=${width}`

export const novusLaunch = defineTemplate({
  id: "marketing_novus_launch",
  subject: () => "Meet Novus — our new 350N beginner line",
  render: (vars) => (
    <EmailDocument
      preview="Certified 350N protection in a lightweight weave, for men, women and kids."
      title="Meet Novus"
    >
      <EmailHeader eyebrow="FENCING-ONLY EQUIPMENT / EST. 2023" />
      <MarketingHero
        chip="NEW / BEGINNER LINE"
        headline="Meet Novus."
        image={heroImage}
        lead="Our new beginner uniform line: certified 350N protection in a lightweight Dyneema-polyester weave. For men, women, and kids."
      >
        <EmailButton href={collectionUrl} spacing={14}>
          Shop the Novus line
        </EmailButton>
      </MarketingHero>
      <Band align="center" heading="CE Level 1 certified / 350N" headingSize={20} padding={28} tone="dark">
        <BandCopy tone="dark">
          Meets the international 350N safety standard, and legal for all USA Fencing sanctioned events.
        </BandCopy>
      </Band>
      <Band heading="Three pieces. One uniform." headingSize={24} kicker="THE NOVUS LINE">
        <ProductCards
          items={[
            {
              action: "Shop now",
              href: `${collectionUrl}/jacket`,
              image: shot("photo-1648484859970-4bfa3acc96f2", 400, 352),
              sub: "350N / Men’s, Women’s and Kids",
              title: "Novus Jacket"
            },
            {
              action: "Shop now",
              href: `${collectionUrl}/pants`,
              image: shot("photo-1648500128137-5d4210c9fe34", 400, 352),
              sub: "350N / Men’s, Women’s and Kids",
              title: "Novus Pants"
            },
            {
              action: "Shop now",
              href: `${collectionUrl}/plastron`,
              image: shot("photo-1631529819887-5b4340090570", 400, 352),
              sub: "350N / CE Level 1",
              title: "Novus Underarm Protector"
            }
          ]}
        />
      </Band>
      <Band heading="Built for your first thousand touches." headingSize={24} kicker="WHY NOVUS" tone="surface">
        <FeatureList
          items={[
            {
              body: "Meets the international CE Level 1 (350N) standard: competition-grade defense for beginners and club fencers.",
              icon: "shieldCheck",
              title: "Certified 350N protection"
            },
            {
              body: "50% Dyneema, 50% polyester for superior tear resistance that resists yellowing and outlasts standard jackets.",
              icon: "layers",
              title: "Dyneema-polyester durability"
            },
            {
              body: "Excellent sweat control and ventilation keep you cool and dry through long sessions.",
              icon: "wind",
              title: "Lightweight, breathable comfort"
            },
            {
              body: "Premium YKK zipper and 4-way stretch design for a great fit that moves with you.",
              icon: "move",
              title: "Unrestricted movement"
            },
            {
              body: "Machine-washable, quick-dry fabric keeps its bright white finish through everyday training.",
              icon: "washingMachine",
              title: "Easy-care club performance"
            }
          ]}
        />
        <Img
          alt="A close view of the reinforced seam and elastic cuff"
          className="fluid"
          height={200}
          src={shot("photo-1779831910458-f0419b4cba3c", 536, 400)}
          style={{ borderRadius: radius, marginTop: 24, objectFit: "cover", width: "100%" }}
          width={536}
        />
        <div
          className="dk-muted"
          style={{
            color: color.inkSoft,
            fontFamily: font.body,
            fontSize: 12,
            fontWeight: 400,
            lineHeight: "18px",
            paddingTop: 8
          }}
        >
          Reinforced seams, elastic cuff, and equipment D-ring, up close.
        </div>
      </Band>
      <Band heading="For the whole club" headingSize={24}>
        <Tiles
          items={[
            { icon: "user", label: "Men’s", line: "Available in a full range of sizes" },
            { icon: "user", label: "Women’s", line: "Available in a full range of sizes" },
            { icon: "baby", label: "Kids", line: "Available in a full range of sizes" }
          ]}
        />
      </Band>
      <HelpCard headline="Where Novus is legal to fence." kicker="COMPETITION NOTES">
        Novus 350N gear is legal for all USA Fencing sanctioned events. For national competitions, 800N (FIE) gear is
        recommended, and it is required for international tournaments.
      </HelpCard>
      <CtaBand
        headline="Suit up. Start fencing."
        href={collectionUrl}
        kicker="THE NOVUS LINE"
        label="Shop the Novus line"
        support="Certified 350N protection for men, women, and kids, ready for club night."
      />
      <MarketingFooter
        fine="You’re receiving this email because you subscribed to Fencing Club updates about new gear and product launches."
        flush
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(novusLaunch)
