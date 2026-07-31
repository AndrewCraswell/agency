import { definePreview, defineTemplate, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { PaidBanner } from "../components/PaidBanner.tsx"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

/* The balance is spelled out even when it is nothing, because nothing left to pay is the news. */
export const pendingPaymentSuccess = defineTemplate({
  type: "pending_payment_success",
  subject: (vars) => `Your payment for ${liquidValue(vars.order.name)} has been received`,
  render: (vars) => (
    <EmailDocument
      preview="We’ve received your payment. Your order is now fully paid and moving into production."
      title="Payment received"
    >
      <EmailHeader eyebrow="PAYMENT RECEIVED" />
      <EmailTitle>Payment received</EmailTitle>
      <EmailLead>
        Thanks, <Var path={vars.customer.first_name} />, we’ve received your payment for order{" "}
        <Var path={vars.order.name} />. Your order is now fully paid and moving into production.
      </EmailLead>
      <PaidBanner label="TOTAL PAID">
        <Var filters={["money"]} path={vars.total_price} />
      </PaidBanner>
      <Totals full>
        <TotalsRow label="Order total">
          <Var filters={["money"]} path={vars.total_price} />
        </TotalsRow>
        <TotalsRow label="Amount paid">
          <Var filters={["money"]} path={vars.total_price} />
        </TotalsRow>
        <TotalsSum label="Balance due">
          <Var filters={["money"]} path={vars.total_outstanding} />
        </TotalsSum>
      </Totals>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(pendingPaymentSuccess)
