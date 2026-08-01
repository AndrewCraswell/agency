import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { CtaBand } from "../components/CtaBand.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { IconCards, OptionCards } from "../components/OptionCards.tsx"
import { ProductCards } from "../components/ProductCards.tsx"
import { shopLinks } from "../components/tokens.ts"

const heroImage = {
  alt: "Two fencers saluting before a bout",
  src: "https://images.unsplash.com/photo-1648500128137-5d4210c9fe34?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

const shot = (photo: string) =>
  `https://images.unsplash.com/${photo}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=352&q=80&w=400`

export const chooseYourWeapon = defineTemplate({
  id: "marketing_choose_your_weapon",
  subject: () => "Foil, épée or sabre — which one is yours?",
  render: (vars) => (
    <EmailDocument
      preview="A quick guide to the three weapons, plus the starter kits that get you on the strip."
      title="Which weapon is yours?"
    >
      <EmailHeader eyebrow="GET STARTED / GUIDE" />
      <MarketingHero
        chip="NEW TO FENCING?"
        headline="Which weapon is yours?"
        image={heroImage}
        lead="Foil, épée or sabre: every fencer starts by choosing one. Here’s a quick guide to help you pick, plus starter kits and bestsellers to get you on the strip."
      >
        <EmailButton href={shopLinks.shop} spacing={14}>
          Explore all weapons
        </EmailButton>
      </MarketingHero>
      <Band heading="Foil vs. épée vs. sabre" headingSize={24} kicker="THE THREE WEAPONS" tone="surface">
        <OptionCards
          items={[
            {
              body: "A light thrusting weapon with right-of-way rules. Rewards precision and timing, the classic first weapon for learning control.",
              icon: "target",
              meta: "TARGET / TORSO",
              name: "Foil"
            },
            {
              body: "The heaviest point weapon, with no right-of-way. Simple rules and a patient, tactical style make it very beginner-friendly.",
              icon: "shield",
              meta: "TARGET / WHOLE BODY",
              name: "Épée"
            },
            {
              body: "A fast cut-and-thrust weapon with right-of-way. Explosive, aggressive and all about speed off the line.",
              icon: "zap",
              meta: "TARGET / ABOVE THE WAIST",
              name: "Sabre"
            }
          ]}
        />
        <IconCards
          items={[
            {
              href: shopLinks.guides,
              icon: "bookOpen",
              sub: "Weapon comparisons, sizing charts and beginner FAQs.",
              title: "Still deciding? Read the buying guides."
            }
          ]}
        />
      </Band>
      <CtaBand
        flush
        headline="Not sure? Start with a kit."
        href={shopLinks.starterKits}
        kicker="THE EASY WAY IN"
        label="Browse starter kits"
        support="Our starter kits pair a weapon with a mask, jacket and glove: everything a beginner needs, matched and ready in one box."
      />
      <Band heading="Bestsellers to get you started" headingSize={24} kicker="FENCER FAVORITES">
        <ProductCards
          items={[
            {
              badge: "BEST SELLER",
              href: "https://fencing.club/products/signature-fie-foil",
              image: shot("photo-1779831910265-589c9bcea696"),
              price: "$189",
              tag: "FOILS",
              title: "Signature FIE Foil"
            },
            {
              badge: "TOP RATED",
              href: "https://fencing.club/products/fie-1600n-mask",
              image: shot("photo-1648500128138-53b62cbb1cf8"),
              price: "$149",
              tag: "MASKS",
              title: "FIE 1600N Mask"
            },
            {
              badge: "POPULAR",
              href: "https://fencing.club/products/350n-club-jacket",
              image: shot("photo-1648484859970-4bfa3acc96f2"),
              price: "$95",
              tag: "JACKETS",
              title: "350N Club Jacket"
            }
          ]}
        />
      </Band>
      <MarketingFooter
        fine="You’re receiving this because you subscribed to Fencing Club. New to the sport? We’re glad you’re here."
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(chooseYourWeapon)
