import {
  Assign,
  binding,
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
import { AddressParty } from "../components/AddressBlock.tsx"
import { CustomerDetail, CustomerInfoCard } from "../components/CustomerInfoCard.tsx"
import { DeliveryGroup } from "../components/DeliveryGroup.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { OrderActions } from "../components/OrderActions.tsx"
import { OrderDiscountRows, OrderWideDiscount, SubtotalRow } from "../components/OrderDiscounts.tsx"
import { PaymentBrand } from "../components/PaymentBrand.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

/* Headings over each parcel only earn their place once an order arrives in more than one. */
const deliveryGroupCount = binding<number>("delivery_group_count")
export const orderConfirmation = defineTemplate({
  type: "order_confirmation",
  subject: (vars) => `Order ${liquidValue(vars.name)} confirmed`,
  render: (vars) => (
    <EmailDocument
      preview="Thanks for your order! We’ve received it and we’re preparing it now. Your order summary is inside."
      title="Thank you for your order"
    >
      <EmailHeader eyebrow="ORDER CONFIRMED" />
      <EmailTitle>Thank you for your order</EmailTitle>
      <EmailLead>
        Hi <Var path={vars.customer.first_name} />, we’ve received order <Var path={vars.name} /> and we’re preparing it
        now. We’ll email you the moment it ships.
      </EmailLead>
      <OrderActions
        href={liquidValue(vars.order_status_url, ["default: shop.url"])}
        shopUrl={vars.shop_app_tracking_url}
        shopVariantKey={vars.shop_app_tracking_button_variant_key}
      >
        View your order
      </OrderActions>
      <ItemList label="ORDER SUMMARY">
        <Assign to={deliveryGroupCount} value="delivery_agreements | size" />
        <If test={gt(deliveryGroupCount, 1)}>
          <For each={vars.delivery_agreements}>
            {(agreement) => (
              <>
                <DeliveryGroup
                  heading={
                    <>
                      <Var path={agreement.delivery_method_name} /> items
                    </>
                  }
                />
                <For each={agreement.line_items}>
                  {(line) => <ItemRow line={line} variantTitle={line.variant_title} />}
                </For>
              </>
            )}
          </For>
          <Else>
            <For each={vars.line_items}>{(line) => <ItemRow line={line} variantTitle={line.variant_title} />}</For>
          </Else>
        </If>
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
        <TotalsSum>
          <Var filters={["money"]} path={vars.total_price} />
        </TotalsSum>
      </Totals>
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
      <SupportBand>Our team replies fast. Just reply to this email or reach us anytime.</SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(orderConfirmation)
