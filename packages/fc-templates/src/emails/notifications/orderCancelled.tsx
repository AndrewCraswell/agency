import {
  Case,
  definePreview,
  defineTemplate,
  Else,
  eq,
  For,
  If,
  isPresent,
  liquidValue,
  Unless,
  Var,
  When
} from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { OrderTotals } from "../components/OrderTotals.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

/*
 * Why the order stopped and what happened to the money are the only two things this message has to
 * answer, so both go in the opening sentence. A declined payment explains itself and takes no
 * payment clause, which is the one case that breaks the pattern.
 */

export const orderCancelled = defineTemplate({
  type: "order_cancelled",
  subject: (vars) => `Order ${liquidValue(vars.order_name)} was canceled`,
  render: (vars) => (
    <EmailDocument preview="This order has been canceled. Here’s what happened to your payment." title="Order canceled">
      <EmailHeader eyebrow="ORDER CANCELED" />
      <EmailTitle>Your order was canceled</EmailTitle>
      <EmailLead>
        Order <Var path={vars.name} />{" "}
        <If test={isPresent(vars.cancel_reason)}>
          <Case on={vars.cancel_reason}>
            <When value="customer">was canceled at your request</When>
            <When value="inventory">was canceled because we did not have enough stock to fulfill your order</When>
            <When value="other">was canceled because of unforeseen circumstances</When>
            <When value="staff">was canceled because of staff error</When>
            <When value="declined">was canceled because your payment was declined</When>
          </Case>
          <Else>was canceled</Else>
        </If>
        <Unless test={eq(vars.cancel_reason, "declined")}>
          {" "}
          <If test={eq(vars.financial_status, "voided")}>
            and your payment has been voided
            <Else>
              <If test={eq(vars.financial_status, "refunded")}>
                and your payment has been refunded
                <Else>and your payment has not yet been refunded</Else>
              </If>
            </Else>
          </If>
        </Unless>
        .
      </EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <EmailButton href={liquidValue(vars.shop.url)} spacing={12} variant="secondary">
        Visit our store
      </EmailButton>
      <ItemList label="REMOVED ITEMS">
        <For each={vars.line_items}>{(line) => <ItemRow free line={line} variantTitle={line.variant_title} />}</For>
      </ItemList>
      <OrderTotals order={vars} />
      <SupportBand heading="Want to order again?">
        Reply to this email and we’ll help you put the same order back together.
      </SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(orderCancelled)
