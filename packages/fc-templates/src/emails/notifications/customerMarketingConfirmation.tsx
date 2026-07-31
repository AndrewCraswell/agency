import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"

export const customerMarketingConfirmation = defineTemplate({
  type: "customer_marketing_confirmation",
  subject: () => "Confirm your Fencing Club subscription",
  render: (vars) => (
    <EmailDocument preview="One tap confirms your subscription." title="Confirm your subscription">
      <EmailHeader eyebrow="EMAIL PREFERENCES" />
      <EmailTitle>Confirm your subscription</EmailTitle>
      <EmailLead>
        One quick tap and you’re in. Confirm your subscription to receive new arrivals, restock alerts, and early access
        to limited Fencing Club releases.
      </EmailLead>
      <EmailButton href={liquidValue(vars.customer.subscribe_url)}>Subscribe</EmailButton>
      <HelpCard headline="Not expecting this?" kicker="GOOD TO KNOW">
        If you didn’t sign up for Fencing Club emails, you can safely ignore this message. You won’t be subscribed.
      </HelpCard>
      {/* Marketing mail, so the footer has to carry the way out even before anyone opts in. */}
      <MarketingFooter shop={vars.shop} unsubscribeUrl={liquidValue(vars.unsubscribe_link)} />
    </EmailDocument>
  )
})

export default definePreview(customerMarketingConfirmation)
