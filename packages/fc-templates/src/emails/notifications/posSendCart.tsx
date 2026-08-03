import { definePreview, defineTemplate, Else, For, gt, If, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { OrderDiscountRows, OrderWideDiscount, SubtotalRow } from "../components/OrderDiscounts.tsx"
import { QuickLinks } from "../components/QuickLinks.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { shopLinks } from "../components/tokens.ts"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

/* A cart our staff built at the counter, so it names the person rather than the abandoned basket. */
export const posSendCart = defineTemplate({
  type: "pos_send_cart",
  subject: (vars) => `Buy online from ${liquidValue(vars.shop.name)} when you're ready!`,
  render: (vars) => (
    <EmailDocument
      preview="Here’s the cart our team built for you in store. Complete your purchase online whenever you’re ready."
      title="Your cart is ready to check out"
    >
      <EmailHeader eyebrow="YOUR CART" />
      <EmailTitle>Your cart is ready to check out</EmailTitle>
      <EmailLead>
        <Var path={vars.customer.first_name} />, thanks for stopping by. Here’s the cart our team put together for you.
        Complete your purchase online whenever you’re ready and we’ll ship it out.
      </EmailLead>
      <ItemList>
        <For each={vars.subtotal_line_items}>
          {(line) => <ItemRow free line={line} variantTitle={line.variant.title} />}
        </For>
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
        <TotalsSum>
          <Var filters={["money"]} path={vars.total_price} />
        </TotalsSum>
      </Totals>
      <EmailButton href={liquidValue(vars.invoice_url, ["default: shop.url"])}>Complete your purchase</EmailButton>
      <QuickLinks />
      <SupportBand>Our team replies fast. Just reply to this email or reach us anytime.</SupportBand>
      <MarketingFooter flush shop={vars.shop} unsubscribeUrl={shopLinks.preferences} />
    </EmailDocument>
  )
})

export default definePreview(posSendCart)
