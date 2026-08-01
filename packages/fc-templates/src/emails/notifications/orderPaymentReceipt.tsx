import {
  definePreview,
  defineTemplate,
  Else,
  eq,
  Find,
  For,
  gt,
  If,
  isTruthy,
  liquidValue,
  Var
} from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { PaymentBrand } from "../components/PaymentBrand.tsx"
import { SummaryCard, SummaryRow } from "../components/SummaryCard.tsx"

/*
 * `transaction_id` names which of the order's transactions this receipt is for, so the template
 * walks `transactions` looking for it rather than assuming the first.
 */

export const orderPaymentReceipt = defineTemplate({
  type: "order_payment_receipt",
  subject: (vars) => `Payment receipt for order ${liquidValue(vars.order_name)}`,
  render: (vars) => (
    <EmailDocument preview="A summary of the payment we received for your order." title="Payment received">
      <EmailHeader eyebrow="PAYMENT RECEIPT" />
      <EmailTitle>Payment received</EmailTitle>
      <EmailLead>
        Thanks, <Var path={vars.customer.first_name} />. We’ve received your payment for order{" "}
        <Var path={vars.order_name} />.
      </EmailLead>
      <ItemList>
        <For each={vars.subtotal_line_items}>{(line) => <ItemRow line={line} variantTitle={line.variant.title} />}</For>
      </ItemList>
      <SummaryCard>
        <SummaryRow label="Subtotal">
          <Var filters={["money"]} path={vars.subtotal_price} />
        </SummaryRow>
        <SummaryRow label="Shipping">
          <If test={gt(vars.shipping_price, 0)}>
            <Var filters={["money"]} path={vars.shipping_price} />
            <Else>Free</Else>
          </If>
        </SummaryRow>
        {/* `transaction_id` names which transaction was charged; the rest are authorisations and refunds. */}
        <Find each={vars.transactions} match={(transaction) => eq(transaction.id, vars.transaction_id)}>
          {(paid) => (
            <>
              <SummaryRow label="Amount paid">
                <Var filters={["money"]} path={paid.amount} />
              </SummaryRow>
              <SummaryRow label="Payment method">
                <If test={isTruthy(paid.payment_details.credit_card_company)}>
                  <PaymentBrand
                    company={paid.payment_details.credit_card_company}
                    lastFour={paid.payment_details.credit_card_last_four_digits}
                  />
                  <Else>
                    <Var path={paid.gateway_display_name} />
                  </Else>
                </If>
              </SummaryRow>
            </>
          )}
        </Find>
        <SummaryRow label="Order number">
          <Var path={vars.order_name} />
        </SummaryRow>
      </SummaryCard>
      <EmailButton href={liquidValue(vars.order_status_url)}>View your order</EmailButton>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(orderPaymentReceipt)
