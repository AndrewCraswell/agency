import { definePreview, defineTemplate, Else, eq, Find, For, If, liquidValue, lt, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"
import { ItemBadge, ItemList, ItemRow } from "../components/ItemRow.tsx"
import { OrderTotals } from "../components/OrderTotals.tsx"
import { TotalsRow } from "../components/Totals.tsx"

/*
 * The message with the customer's money in it, so what came back and where it went are both said
 * plainly before the order is restated underneath.
 */

export const refundNotification = defineTemplate({
  type: "refund_notification",
  subject: (vars) => `A refund for order ${liquidValue(vars.order_name)} is on its way`,
  render: (vars) => (
    <EmailDocument preview="Your refund has been issued." title="Your refund is on its way">
      <EmailHeader eyebrow="REFUND ISSUED" />
      <EmailTitle>Your refund is on its way</EmailTitle>
      <EmailLead>
        Total amount refunded: <Var filters={["money_with_currency"]} path={vars.amount} />. It may take up to 10 days
        for this refund to appear in your account.
      </EmailLead>
      {/* Store credit never reaches a card, so a customer looking at a statement needs telling. */}
      <Find each={vars.transactions} match={(transaction) => eq(transaction.gateway, "shopify_store_credit")}>
        {() => (
          <HelpCard headline="This refund went to your store credit" kicker="WHERE IT WENT">
            The amount is already on your account and will be applied automatically at your next checkout.
          </HelpCard>
        )}
      </Find>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <ItemList label="REFUNDED ITEMS">
        <For each={vars.refund_line_items}>
          {(refunded) => (
            <ItemRow
              badge={
                <ItemBadge>
                  {/* Stock compares a quantity with itself here, so the partial case never printed. */}
                  <If test={lt(refunded.quantity, refunded.line_item.quantity)}>
                    Refunded <Var path={refunded.quantity} /> of <Var path={refunded.line_item.quantity} />
                    <Else>Refunded</Else>
                  </If>
                </ItemBadge>
              }
              credit
              line={refunded.line_item}
              quantity={refunded.quantity}
              variantTitle={refunded.line_item.variant_title}
            />
          )}
        </For>
      </ItemList>
      <ItemList label="ORDER SUMMARY">
        <For each={vars.line_items_including_zero_quantity}>
          {(line) => <ItemRow free line={line} variantTitle={line.variant_title} />}
        </For>
      </ItemList>
      <OrderTotals order={vars}>
        <TotalsRow credit label="Refund">
          −<Var filters={["money"]} path={vars.amount} />
        </TotalsRow>
      </OrderTotals>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(refundNotification)
