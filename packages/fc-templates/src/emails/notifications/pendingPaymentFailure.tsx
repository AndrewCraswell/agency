import { definePreview, defineTemplate, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

export const pendingPaymentFailure = defineTemplate({
  type: "pending_payment_failure",
  subject: (vars) => `We couldn’t process your payment for order ${liquidValue(vars.order_name)}`,
  render: (vars) => (
    <EmailDocument
      preview="Return to your cart to complete your purchase."
      title="There was a problem with your payment"
    >
      <EmailHeader eyebrow="PAYMENT FAILED" />
      <EmailTitle>There was a problem with your payment</EmailTitle>
      <EmailLead>
        We couldn’t process the payment for order <Var path={vars.order_name} />
        {/* A purchase order number is a B2B field, so most orders carry none. */}
        <If test={isPresent(vars.po_number)}>
          {" "}
          (PO <Var path={vars.po_number} />)
        </If>
        . Return to your cart to complete your purchase.
      </EmailLead>
      <If test={isPresent(vars.checkout_payment_collection_url)}>
        <EmailButton href={liquidValue(vars.checkout_payment_collection_url)}>Return to cart</EmailButton>
      </If>
      <SupportBand heading="Trouble with your payment?">
        Our team can help sort it out fast. Just reply to this email or reach us anytime.
      </SupportBand>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(pendingPaymentFailure)
