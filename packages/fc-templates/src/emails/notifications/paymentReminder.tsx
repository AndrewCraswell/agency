import {
  and,
  definePreview,
  defineTemplate,
  Else,
  ElseIf,
  eq,
  If,
  isPresent,
  isTruthy,
  liquidValue,
  Var
} from "@repo/shopify-emails"
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
    <EmailDocument preview="Payment for your order is still due." title="Your payment is due">
      <EmailHeader eyebrow="PAYMENT DUE" />
      <EmailTitle>Your payment is due</EmailTitle>
      <EmailLead>
        {/* A merchant can replace the standard line from the admin, so the default is the fallback. */}
        <If test={isPresent(vars.custom_message)}>
          <Var raw path={vars.custom_message} />
          <Else>
            This is a reminder that your payment of{" "}
            <Var filters={["money_with_currency"]} path={vars.payment_schedule.amount_due} /> for order{" "}
            <Var path={vars.name} /> {/* Due today, due later, and already past due each need their own tense. */}
            <If
              test={and(
                isTruthy(vars.payment_schedule["overdue?"]),
                eq(vars.payment_schedule.number_of_days_overdue, 0)
              )}
            >
              is due today.
              <ElseIf test={isTruthy(vars.payment_schedule["due_later?"])}>
                is due on <Var filters={["date: '%B %-d, %Y'"]} path={vars.payment_schedule.due_at} />.
              </ElseIf>
              <Else>
                was due on <Var filters={["date: '%B %-d, %Y'"]} path={vars.payment_schedule.due_at} /> and is now
                overdue.
              </Else>
            </If>
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
          <Var filters={["date: '%b %-d, %Y'"]} path={vars.payment_schedule.due_at} />
        </SummaryRow>
      </SummaryCard>
      <If test={isPresent(vars.checkout_payment_collection_url)}>
        <EmailButton href={liquidValue(vars.checkout_payment_collection_url)}>Pay now</EmailButton>
      </If>
      <SupportBand heading="Questions about this payment?">
        Our team can walk you through it. Just reply to this email or reach us anytime.
      </SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(paymentReminder)
