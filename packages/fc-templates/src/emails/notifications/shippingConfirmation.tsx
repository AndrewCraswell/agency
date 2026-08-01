import { definePreview, defineTemplate, For, If, isTruthy, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { fulfillmentBody, FulfillmentCopy, fulfillmentTitle } from "../components/FulfillmentCopy.tsx"
import { ItemList, ItemRow, presentedTitle } from "../components/ItemRow.tsx"
import { Tracking } from "../components/Tracking.tsx"

/*
 * `item_count` is the whole order and `fulfillment.item_count` is this shipment, so the two
 * together say whether the order shipped complete.
 */

export const shippingConfirmation = defineTemplate({
  type: "shipping_confirmation",
  subject: (vars) => `Order ${liquidValue(vars.order_name)} is on the way`,
  render: (vars) => (
    <EmailDocument
      preview={`Good news — order ${liquidValue(vars.order_name)} has shipped and is on its way to you.`}
      title="Your order is on the way"
    >
      <FulfillmentCopy
        fulfillmentStatus={vars.fulfillment_status}
        orderItems={vars.item_count}
        shipmentItems={vars.fulfillment.item_count}
        trailer="Track your shipment to see the delivery status."
        wording={{
          whole: "Your order is on the way",
          lastOfSeveral: "The last items in your order are on the way",
          someOfSeveral: "Some items in your order are on the way",
          lastSingle: "The last item in your order is on the way",
          oneSingle: "One item in your order is on the way"
        }}
      />
      <EmailHeader eyebrow="ON THE WAY" />
      <EmailTitle>
        <Var path={fulfillmentTitle} />
      </EmailTitle>
      <EmailLead>
        <Var path={fulfillmentBody} />
      </EmailLead>
      <If test={isTruthy(vars.fulfillment.estimated_delivery_at)}>
        <EmailLead>
          Estimated delivery date:{" "}
          <Var filters={["date: format: 'date'"]} path={vars.fulfillment.estimated_delivery_at} />
        </EmailLead>
      </If>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <Tracking fulfillment={vars.fulfillment} />
      <ItemList label="ITEMS IN DELIVERY">
        <For each={vars.fulfillment.fulfillment_line_items}>
          {(line) => (
            <ItemRow
              line={line.line_item}
              quantity={line.quantity}
              title={presentedTitle(line.line_item)}
              variantTitle={line.line_item.variant.title}
            />
          )}
        </For>
      </ItemList>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(shippingConfirmation)
