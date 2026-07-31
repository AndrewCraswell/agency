import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"

export const customerAddPaymentMethod = defineTemplate({
  type: "customer_add_payment_method",
  subject: () => "Add a payment method to your Fencing Club account",
  render: (vars) => (
    <EmailDocument preview="Add a card to check out faster next time." title="Add a payment method">
      <EmailHeader eyebrow="PAYMENT METHOD" />
      <EmailTitle>Add a payment method</EmailTitle>
      <EmailLead>Add a card to your account to check out faster and keep your orders moving without a hitch.</EmailLead>
      <EmailButton href={liquidValue(vars.email_confirmation_url)}>Add payment method</EmailButton>
      <HelpCard headline="We protect your payment details" kicker="YOUR SECURITY">
        For your security, we’ll never ask for full card details by email.
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(customerAddPaymentMethod)
