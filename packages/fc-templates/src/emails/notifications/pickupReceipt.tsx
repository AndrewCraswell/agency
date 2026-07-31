import { definePreview, defineTemplate, Else, For, gt, If, liquidValue, Var } from "@repo/shopify-emails"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

/* No call to action: the goods are already in the customer's hands, so the receipt just records it. */
export const pickupReceipt = defineTemplate({
  type: "pickup_receipt",
  subject: (vars) => `Receipt for order ${liquidValue(vars.name)}`,
  render: (vars) => (
    <EmailDocument
      preview={`Order ${liquidValue(vars.name)} was picked up. Here is your receipt.`}
      title="Your order has been picked up"
    >
      <EmailHeader eyebrow="PICKED UP" />
      <EmailTitle>Your order has been picked up</EmailTitle>
      <EmailLead>
        Order <Var path={vars.name} /> was picked up at our Boston location. Thanks for choosing Fencing Club. Here’s
        your receipt.
      </EmailLead>
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
      <SupportBand>Our team replies fast. Just reply to this email or reach us anytime.</SupportBand>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(pickupReceipt)
