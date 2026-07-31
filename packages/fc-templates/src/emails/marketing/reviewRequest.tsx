import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { PurchasedCard, RatePrompt } from "../components/ProductFeature.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

const productUrl = "https://fencing.club/products/elite-fie-sabre"
const reviewUrl = `${productUrl}#write-a-review`

export const reviewRequest = defineTemplate({
  id: "marketing_review_request",
  subject: () => "How’s your new gear?",
  render: (vars) => (
    <EmailDocument
      preview="A quick review helps other fencers choose their gear. It only takes a minute."
      title="How’s your new gear?"
    >
      <EmailHeader eyebrow="REVIEW REQUEST" />
      <MarketingHero
        chip="HOW’D WE DO?"
        headline="How’s your new gear?"
        lead="You’ve had a couple weeks to put it to the test. A quick review helps other fencers choose their gear, and it only takes a minute."
      >
        <PurchasedCard
          href={productUrl}
          image="https://images.unsplash.com/photo-1779831910182-9447c147dab0?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=200&q=80&w=200"
          meta="Order #FC-20418 / Delivered Feb 9"
          tag="SABRES"
          title="Elite FIE Sabre (Maraging)"
        />
      </MarketingHero>
      <Band padding={36} tone="surface">
        <RatePrompt hint="Tap a star to begin your review" kicker="RATE YOUR PURCHASE" prompt="How many stars?" />
        <EmailButton href={reviewUrl} spacing={20}>
          Write a review
        </EmailButton>
      </Band>
      <SupportBand flush heading="Trouble with your gear?">
        If something isn’t right with your gear, tell us before you review, we’ll make it good.
      </SupportBand>
      <MarketingFooter
        fine="You’re receiving this email because you recently purchased from Fencing Club."
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(reviewRequest)
