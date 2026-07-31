import {
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
import { AddressDetail, AddressPair } from "../components/AddressBlock.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

type PartyProps = {
  readonly address: PathRef<OrderAddress>
  readonly kicker: string
}

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
      <AddressPair
        left={<Party address={vars.shipping_address} kicker="SHIP TO" />}
        right={<Party address={vars.billing_address} kicker="BILL TO" />}
      />
      <AddressPair
        label="SHIPPING & PAYMENT"
        left={<AddressDetail headline={<Var path={vars.shipping_method.title} />} kicker="SHIPPING METHOD" />}
        right={
          <AddressDetail
            headline={
              <Find each={vars.transactions} match={(transaction) => isPresent(transaction.payment_details)}>
                {(transaction) => (
                  <>
                    <Var path={transaction.payment_details.credit_card_company} /> ending{" "}
                    <Var path={transaction.payment_details.credit_card_last_four_digits} />
                  </>
                )}
              </Find>
            }
            kicker="PAYMENT"
          >
            Total <Var filters={["money"]} path={vars.total_price} />
          </AddressDetail>
        }
      />
      <SupportBand>Our team replies fast. Just reply to this email or reach us anytime.</SupportBand>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(orderConfirmation)
