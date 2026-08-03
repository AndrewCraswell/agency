import { definePreview, defineTemplate, For, liquidValue, Var } from "@repo/shopify-emails"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { fulfillmentBody, FulfillmentCopy, fulfillmentTitle } from "../components/FulfillmentCopy.tsx"
import { ItemList, ItemRow, presentedTitle } from "../components/ItemRow.tsx"
import { OrderActions } from "../components/OrderActions.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { Tracking } from "../components/Tracking.tsx"

/* No estimated delivery date here: it has arrived, so the date the carrier promised is spent. */
export const shipmentDelivered = defineTemplate({
  type: "shipment_delivered",
  subject: (vars) => `Order ${liquidValue(vars.order_name)} has been delivered`,
  render: (vars) => (
    <EmailDocument preview={`Order ${liquidValue(vars.order_name)} has been delivered.`} title="Your order has arrived">
      <FulfillmentCopy
        fulfillmentStatus={vars.fulfillment_status}
        orderItems={vars.item_count}
        shipmentItems={vars.fulfillment.item_count}
        trailer="Track your shipment to see the delivery status."
        wording={{
          whole: "Your order has been delivered",
          lastOfSeveral: "The last items in your order have been delivered",
          someOfSeveral: "Some items in your order have been delivered",
          lastSingle: "The last item in your order has been delivered",
          oneSingle: "One item in your order has been delivered"
        }}
      />
      <EmailHeader eyebrow="DELIVERED" />
      <EmailTitle>
        <Var path={fulfillmentTitle} />
      </EmailTitle>
      <EmailLead>
        <Var path={fulfillmentBody} />
      </EmailLead>
      <OrderActions
        href={liquidValue(vars.order_status_url, ["default: shop.url"])}
        shopUrl={vars.shop_app_tracking_url}
        shopVariantKey={vars.shop_app_tracking_button_variant_key}
      >
        View your order
      </OrderActions>
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
      <SupportBand heading="Something not right?">
        If anything arrived damaged or wasn’t what you expected, our team will make it right. Just reply to this email
        or reach out anytime.
      </SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(shipmentDelivered)
