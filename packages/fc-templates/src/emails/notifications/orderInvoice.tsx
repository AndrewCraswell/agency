import { definePreview, defineTemplate, Else, For, gt, If, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

export const orderInvoice = defineTemplate({
  type: "order_invoice",
  subject: (vars) => `Invoice ${liquidValue(vars.name)} is ready`,
  render: (vars) => (
    <EmailDocument
      preview={`Invoice ${liquidValue(vars.name)} is ready. Pay securely online whenever you’re ready.`}
      title="Your invoice is ready"
    >
      <EmailHeader eyebrow="INVOICE" />
      <EmailTitle>
        Payment of <Var filters={["money"]} path={vars.total_price} /> is due
      </EmailTitle>
      <EmailLead>
        Invoice <Var path={vars.name} /> is ready. Pay securely online whenever you’re ready.
      </EmailLead>
      <EmailButton href={liquidValue(vars.checkout_payment_collection_url, ["default: shop.url"])}>Pay now</EmailButton>
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
        <TotalsSum label="Amount due">
          <Var filters={["money"]} path={vars.total_price} />
        </TotalsSum>
      </Totals>
      <SupportBand>Our team replies fast. Just reply to this email or reach us anytime.</SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(orderInvoice)
