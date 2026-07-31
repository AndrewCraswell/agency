import { definePreview, defineTemplate, If, isPresent, liquidValue } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

export const failedPaymentProcessing = defineTemplate({
  type: "failed_payment_processing",
  subject: () => "We couldn’t process your payment",
  render: (vars) => (
    <EmailDocument
      preview="Your payment didn’t go through and you have not been charged."
      title="We couldn’t process your payment"
    >
      <EmailHeader eyebrow="PAYMENT FAILED" />
      <EmailTitle>We couldn’t process your payment</EmailTitle>
      <EmailLead>
        Your payment didn’t go through and you have not been charged. Return to your cart to try again with another
        method.
      </EmailLead>
      {/* Shopify omits the link when the cart is gone, so the button goes with it. */}
      <If test={isPresent(vars.url)}>
        <EmailButton href={liquidValue(vars.url)}>Return to cart</EmailButton>
      </If>
      <SupportBand heading="Trouble with your payment?">
        Our team can help sort it out fast. Just reply to this email or reach us anytime.
      </SupportBand>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(failedPaymentProcessing)
