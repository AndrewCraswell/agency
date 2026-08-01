import {
  definePreview,
  defineTemplate,
  Else,
  Find,
  For,
  gt,
  If,
  isPresent,
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
import { SupportBand } from "../components/SupportBand.tsx"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

export const storeReceipt = defineTemplate({
  type: "store_receipt",
  subject: (vars) => `Receipt for order ${liquidValue(vars.name)}`,
  render: (vars) => (
    <EmailDocument
      preview={`Your payment went through. Here’s your receipt for order ${liquidValue(vars.name)}.`}
      title="Your receipt"
    >
      <EmailHeader eyebrow="RECEIPT" />
      <EmailTitle>
        Receipt for order <Var path={vars.name} />
      </EmailTitle>
      <EmailLead>Thanks for shopping with Fencing Club. Your payment went through, so here’s your receipt.</EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <ItemList label="ORDER SUMMARY">
        <For each={vars.line_items}>{(line) => <ItemRow line={line} variantTitle={line.variant_title} />}</For>
      </ItemList>
      <Totals>
        <TotalsRow label="Subtotal">
          <Var filters={["money"]} path={vars.subtotal_price} />
        </TotalsRow>
        <If test={gt(vars.total_discounts, 0)}>
          <TotalsRow credit label="Discount">
            −<Var filters={["money"]} path={vars.total_discounts} />
          </TotalsRow>
        </If>
        <TotalsRow label="Shipping">
          <If test={gt(vars.shipping_price, 0)}>
            <Var filters={["money"]} path={vars.shipping_price} />
            <Else>Free</Else>
          </If>
        </TotalsRow>
        <If test={gt(vars.tax_price, 0)}>
          <TotalsRow label="Tax">
            <Var filters={["money"]} path={vars.tax_price} />
          </TotalsRow>
        </If>
        <TotalsSum>
          <Var filters={["money"]} path={vars.total_price} />
        </TotalsSum>
      </Totals>
      <Totals label="PAYMENT">
        <TotalsRow
          label={
            <Find each={vars.transactions} match={(transaction) => isPresent(transaction.payment_details)}>
              {(transaction) => (
                <PaymentBrand
                  company={transaction.payment_details.credit_card_company}
                  lastFour={transaction.payment_details.credit_card_last_four_digits}
                />
              )}
            </Find>
          }
        >
          <Var filters={["money"]} path={vars.total_price} />
        </TotalsRow>
      </Totals>
      <SupportBand>Our team replies fast. Just reply to this email or reach us anytime.</SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(storeReceipt)
