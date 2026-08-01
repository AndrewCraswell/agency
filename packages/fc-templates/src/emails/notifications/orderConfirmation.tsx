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
  type OrderAddress,
  type PathRef,
  Var
} from "@repo/shopify-emails"
import { AddressDetail } from "../components/AddressBlock.tsx"
import { CustomerDetail, CustomerInfoCard } from "../components/CustomerInfoCard.tsx"
import { DeliveryGroup } from "../components/DeliveryGroup.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { PaymentBrand } from "../components/PaymentBrand.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

type PartyProps = {
  readonly address: PathRef<OrderAddress>
  readonly kicker: string
}

/* Headings over each parcel only earn their place once an order arrives in more than one. */
const deliveryGroupCount = binding<number>("delivery_group_count")

/* A second address line is the exception, so it joins the first rather than claiming a line. */
const Party = ({ address, kicker }: PartyProps) => (
  <AddressDetail
    headline={
      <>
        <Var path={address.first_name} /> <Var path={address.last_name} />
      </>
    }
    kicker={kicker}
  >
    <div>
      <Var path={address.address1} />
      <If test={isPresent(address.address2)}>
        , <Var path={address.address2} />
      </If>
    </div>
    <div>
      <Var path={address.city} />, <Var path={address.province_code} /> <Var path={address.zip} />
    </div>
    <div>
      <Var path={address.country} />
    </div>
  </AddressDetail>
)

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
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
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
      <CustomerInfoCard
        billTo={<Party address={vars.billing_address} kicker="BILLING ADDRESS" />}
        label="CUSTOMER INFORMATION"
        leftDetail={
          <CustomerDetail
            label="PAYMENT"
            note={
              <>
                <Var path={vars.shipping_method.title} />, <Var filters={["money"]} path={vars.total_price} />
              </>
            }
          >
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
          <CustomerDetail
            label="ORDER DATE"
            note={
              <>
                Order <Var path={vars.name} />
              </>
            }
          >
            <Var filters={['date: "%B %-d, %Y"']} path={vars.created_at} />
          </CustomerDetail>
        }
        shipTo={<Party address={vars.shipping_address} kicker="SHIPPING ADDRESS" />}
      />
      <SupportBand>Our team replies fast. Just reply to this email or reach us anytime.</SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(orderConfirmation)
