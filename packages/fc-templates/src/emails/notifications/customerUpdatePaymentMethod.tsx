import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"

export const customerUpdatePaymentMethod = defineTemplate({
  type: "customer_update_payment_method",
  subject: () => "Update your payment method",
  render: (vars) => (
    <EmailDocument
      preview="Your card is expiring soon. Update it to avoid interruptions."
      title="Update your payment method"
    >
      <EmailHeader eyebrow="PAYMENT METHOD" />
      <EmailTitle>Update your payment method</EmailTitle>
      <EmailLead>
        The card on your account is expiring soon. Update it now to avoid any interruption to your orders.
      </EmailLead>
      <EmailButton href={liquidValue(vars.email_confirmation_url)}>Update payment information</EmailButton>
      <HelpCard headline="We protect your payment details" kicker="YOUR SECURITY">
        For your security, we’ll never ask for full card details by email.
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(customerUpdatePaymentMethod)
