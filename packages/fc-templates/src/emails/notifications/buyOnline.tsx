import { definePreview, defineTemplate, Else, For, gt, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { QuickLinks } from "../components/QuickLinks.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { shopLinks } from "../components/tokens.ts"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

/* A cart the till saved rather than an order, so the button goes to checkout, not order status. */
export const buyOnline = defineTemplate({
  type: "buy_online",
  subject: () => "Are you ready to complete your order?",
  render: (vars) => (
    <EmailDocument
      preview="Your in-store cart is saved. Finish your purchase online and we’ll ship it straight to you."
      title="Finish your purchase online"
    >
      <EmailHeader eyebrow="FINISH CHECKOUT" />
      <EmailTitle>Finish your purchase online</EmailTitle>
      <EmailLead>
        You left a few things behind in store. Your cart is saved, so complete your order online and we’ll ship it
        straight to you.
      </EmailLead>
      <ItemList>
        <For each={vars.subtotal_line_items}>
          {(line) => <ItemRow free line={line} variantTitle={line.variant.title} />}
        </For>
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
        <TotalsSum>
          <Var filters={["money"]} path={vars.total_price} />
        </TotalsSum>
      </Totals>
      <If test={isPresent(vars.custom_message)}>
        <EmailLead>
          <Var path={vars.custom_message} />
        </EmailLead>
      </If>
      <EmailButton href={liquidValue(vars.invoice_url, ["default: shop.url"])}>Complete your purchase</EmailButton>
      <QuickLinks />
      <SupportBand>Our team replies fast. Just reply to this email or reach us anytime.</SupportBand>
      <MarketingFooter flush shop={vars.shop} unsubscribeUrl={shopLinks.preferences} />
    </EmailDocument>
  )
})

export default definePreview(buyOnline)
