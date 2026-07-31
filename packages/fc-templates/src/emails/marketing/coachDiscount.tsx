import { definePreview, defineTemplate, liquidValue, Var } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { CodeCard } from "../components/CodeCard.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { HelpCard } from "../components/HelpCard.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { OfferBand } from "../components/OfferBand.tsx"
import { IconCards } from "../components/OptionCards.tsx"
import { StepList } from "../components/StepList.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { shopLinks } from "../components/tokens.ts"

const heroImage = {
  alt: "A rack of épée blades in the armory",
  src: "https://images.unsplash.com/photo-1578531859022-fb66af8e9d51?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

export const coachDiscount = defineTemplate({
  id: "marketing_coach_discount",
  subject: () => "Your Coach Discount is active",
  render: (vars) => (
    <EmailDocument
      preview="15% off Fencing Club branded products, applied automatically at checkout."
      title="Welcome to the Club, Coach"
    >
      <EmailHeader eyebrow="COACH DISCOUNT" />
      <MarketingHero
        chip="COACH DISCOUNT ACTIVE"
        headline="Welcome to the Club, Coach."
        image={heroImage}
        lead="Your club’s Coach Discount is active. From today, your gear orders get 15% off all Fencing Club branded products, automatically."
      >
        <EmailButton href={shopLinks.shop} spacing={14}>
          Start shopping
        </EmailButton>
      </MarketingHero>
      <OfferBand
        figure="15%"
        label="Off Fencing Club branded products"
        note="Applied automatically at checkout. Excludes other name brands."
      />
      <CodeCard code={<Var path={vars.customer.email} />} label="YOUR REGISTERED EMAIL">
        This is the address on your Coach Discount account. Enter it exactly at checkout to trigger your discount.
      </CodeCard>
      <Band kicker="HOW YOUR DISCOUNT WORKS" padding={36}>
        <StepList
          items={[
            {
              body: "Browse fencing.club and add gear to your cart. No codes needed.",
              title: "Shop as usual"
            },
            {
              body: "That’s the address shown above, the one this message was sent to.",
              title: "Enter your registered email at checkout"
            },
            {
              body: "Your Coach Discount applies instantly to all Fencing Club branded products in your order.",
              title: "15% comes off automatically"
            }
          ]}
        />
      </Band>
      <Band kicker="WHAT THE 15% COVERS" padding={32} tone="surface">
        <IconCards
          items={[
            {
              icon: "check",
              sub: "Everything we make: uniforms, blades, weapons, kits, and gear carrying the Fencing Club name.",
              title: "Fencing Club branded products"
            },
            {
              icon: "minus",
              sub: "Products from other manufacturers we carry are not part of the Coach Discount.",
              title: "Other name brands"
            }
          ]}
        />
      </Band>
      <HelpCard headline="We can mark your account tax exempt." kicker="TAX-EXEMPT ORGANIZATION?">
        If your club or school is a tax-exempt organization, reply with your exemption note or resale permit and we’ll
        mark your account as tax exempt. Future orders will be billed accordingly.
      </HelpCard>
      <SupportBand flush heading="Discount not applying?">
        Our support team sorts Coach Discount issues fast. Just reach out and we’ll get you taken care of.
      </SupportBand>
      <MarketingFooter
        fine="You’re receiving this because your club signed up for the Fencing Club Coach Discount."
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(coachDiscount)
