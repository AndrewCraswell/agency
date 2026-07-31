import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"

export const customerRestorePaymentMethod = defineTemplate({
  type: "customer_restore_payment_method",
  subject: () => "Verify your payment information",
  render: (vars) => (
    <EmailDocument preview="Confirm the payment details on your account." title="Verify your payment information">
      <EmailHeader eyebrow="VERIFY PAYMENT" />
      <EmailTitle>Verify your payment information</EmailTitle>
      <EmailLead>
        We need you to confirm the payment details on your account so we can keep processing your orders smoothly.
      </EmailLead>
      <EmailButton href={liquidValue(vars.email_confirmation_url)}>Update payment information</EmailButton>
      <HelpCard headline="We protect your payment details" kicker="YOUR SECURITY">
        For your security, we’ll never ask for full card details by email.
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(customerRestorePaymentMethod)
