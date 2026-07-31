import { definePreview, defineTemplate, Else, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { SummaryCard, SummaryRow } from "../components/SummaryCard.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

/* This notification names the order `name` rather than `order_name`. */
export const paymentReminder = defineTemplate({
  type: "payment_reminder",
  subject: (vars) => `Payment reminder for order ${liquidValue(vars.name)}`,
  render: (vars) => (
    <EmailDocument preview="Payment for your order is still due." title="Payment reminder">
      <EmailHeader eyebrow="PAYMENT DUE" />
      <EmailTitle>Payment reminder</EmailTitle>
      <EmailLead>
        {/* A merchant can replace the standard line from the admin, so the default is the fallback. */}
        <If test={isPresent(vars.custom_message)}>
          <Var path={vars.custom_message} />
          <Else>
            A friendly reminder that payment for order <Var path={vars.name} /> is still due. Complete your payment to
            keep your order on track.
          </Else>
        </If>
      </EmailLead>
      <SummaryCard>
        <SummaryRow label="Amount due">
          <Var filters={["money"]} path={vars.payment_schedule.amount_due} />
        </SummaryRow>
        <SummaryRow label="Order number">
          <Var path={vars.name} />
        </SummaryRow>
        <SummaryRow label="Due date">
          <Var filters={["date: '%b %e, %Y'"]} path={vars.payment_schedule.due_at} />
        </SummaryRow>
      </SummaryCard>
      <If test={isPresent(vars.checkout_payment_collection_url)}>
        <EmailButton href={liquidValue(vars.checkout_payment_collection_url)}>Pay now</EmailButton>
      </If>
      <SupportBand heading="Questions about this payment?">
        Our team can walk you through it. Just reply to this email or reach us anytime.
      </SupportBand>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(paymentReminder)
