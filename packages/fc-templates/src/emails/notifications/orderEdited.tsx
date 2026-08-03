import {
  definePreview,
  defineTemplate,
  Else,
  Find,
  For,
  If,
  isPresent,
  liquidValue,
  lt,
  Var
} from "@repo/shopify-emails"
import { AddressParty } from "../components/AddressBlock.tsx"
import { CustomerDetail, CustomerInfoCard } from "../components/CustomerInfoCard.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemBadge, ItemList, ItemRow } from "../components/ItemRow.tsx"
import { OrderTotals } from "../components/OrderTotals.tsx"
import { PaymentBrand } from "../components/PaymentBrand.tsx"

/*
 * The order as it now stands, rather than a description of what moved. A line that survived at a
 * smaller count says so on its own row, and a line that went to nothing keeps its place, because
 * an item silently missing from a list is the thing customers write in about.
 */

export const orderEdited = defineTemplate({
  type: "order_edited",
  subject: (vars) => `Order ${liquidValue(vars.order_name)} was updated`,
  render: (vars) => (
    <EmailDocument preview="Your order has changed. Here it is as it now stands." title="Your order was updated">
      <EmailHeader eyebrow="ORDER UPDATED" />
      <EmailTitle>Your order was updated</EmailTitle>
      <EmailLead>
        Hi <Var filters={["default: 'there'"]} path={vars.customer.first_name} />, order <Var path={vars.order_name} />{" "}
        has been updated. Everything below reflects the order as it now stands.
      </EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <EmailButton href={liquidValue(vars.shop.url)} spacing={12} variant="secondary">
        Visit our store
      </EmailButton>
      <ItemList label="UPDATED ORDER">
        <For each={vars.line_items_including_zero_quantity}>
          {(line) => (
            <ItemRow
              badge={
                /* Stock compares a quantity with itself here, so neither case ever printed. */
                <If test={lt(line.current_quantity, line.quantity)}>
                  <ItemBadge>
                    <If test={lt(0, line.current_quantity)}>
                      <Var path={line.current_quantity} /> of <Var path={line.quantity} /> kept
                      <Else>Removed</Else>
                    </If>
                  </ItemBadge>
                </If>
              }
              free
              line={line}
              quantity={line.current_quantity}
              variantTitle={line.variant_title}
            />
          )}
        </For>
      </ItemList>
      <OrderTotals order={vars} />
      <CustomerInfoCard
        billTo={<AddressParty address={vars.billing_address} kicker="BILLING ADDRESS" />}
        label="CUSTOMER INFORMATION"
        leftDetail={
          <CustomerDetail label="PAYMENT">
            <Find each={vars.transactions} match={(transaction) => isPresent(transaction.payment_details)}>
              {(transaction) => (
                <PaymentBrand
                  company={transaction.payment_details.credit_card_company}
                  lastFour={transaction.payment_details.credit_card_last_four_digits}
                />
              )}
            </Find>
          </CustomerDetail>
        }
        rightDetail={
          <CustomerDetail label="SHIPPING METHOD">
            <Var path={vars.shipping_method.title} />
          </CustomerDetail>
        }
        shipTo={<AddressParty address={vars.shipping_address} kicker="SHIPPING ADDRESS" />}
      />
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(orderEdited)
