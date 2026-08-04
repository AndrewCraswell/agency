import { definePreview, defineTemplate, Else, For, gt, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { OrderDiscountRows, OrderWideDiscount, SubtotalRow } from "../components/OrderDiscounts.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

/* A draft is not yet an order, so this asks for a checkout rather than a payment on a balance. */
export const draftOrderInvoice = defineTemplate({
  type: "draft_order_invoice",
  subject: (vars) => `Your invoice ${liquidValue(vars.name)} is ready`,
  render: (vars) => (
    <EmailDocument
      preview={`Your invoice ${liquidValue(vars.name)} is ready. Review your order and check out when you are ready.`}
      title="Complete your purchase"
    >
      <EmailHeader eyebrow="INVOICE" />
      <EmailTitle>Complete your purchase</EmailTitle>
      <EmailLead>
        Your invoice <Var path={vars.name} /> is ready. Review your order and check out whenever you’re ready.
      </EmailLead>
      <If test={isPresent(vars.custom_message)}>
        <EmailLead>
          <Var raw path={vars.custom_message} />
        </EmailLead>
      </If>
      <EmailButton href={liquidValue(vars.invoice_url, ["default: shop.url"])}>Complete your purchase</EmailButton>
      <ItemList label="ORDER SUMMARY">
        <For each={vars.line_items}>{(line) => <ItemRow line={line} variantTitle={line.variant_title} />}</For>
      </ItemList>
      <Totals>
        <OrderWideDiscount order={vars} />
        <SubtotalRow order={vars} />
        <OrderDiscountRows order={vars} />
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

export default definePreview(draftOrderInvoice)
