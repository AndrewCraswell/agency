import { definePreview, defineTemplate, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"

export const companyLocationUpdatePaymentMethod = defineTemplate({
  type: "company_location_update_payment_method",
  subject: (vars) => `Update the payment method for ${liquidValue(vars.location_name)}`,
  render: (vars) => (
    <EmailDocument
      preview="Update your location's payment method to keep orders processing."
      title="Update your location's payment method"
    >
      <EmailHeader eyebrow="PAYMENT METHOD" />
      <EmailTitle>Update your location’s payment method</EmailTitle>
      <EmailLead>
        The payment method for <Var path={vars.location_name} /> needs attention. Update it now to keep your team’s
        orders processing without interruption.
      </EmailLead>
      <EmailButton href={liquidValue(vars.email_confirmation_url)}>Update payment information</EmailButton>
      <HelpCard headline="We protect your payment details" kicker="YOUR SECURITY">
        For your security, we’ll never ask for full card details by email.
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(companyLocationUpdatePaymentMethod)
