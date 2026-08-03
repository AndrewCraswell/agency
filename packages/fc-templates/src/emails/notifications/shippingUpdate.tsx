import { definePreview, defineTemplate, For, If, isTruthy, liquidValue, Var } from "@repo/shopify-emails"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow, presentedTitle } from "../components/ItemRow.tsx"
import { OrderActions } from "../components/OrderActions.tsx"
import { Tracking } from "../components/Tracking.tsx"

/* The headline does not branch on how much shipped: the news is the tracking, not the contents. */
export const shippingUpdate = defineTemplate({
  type: "shipping_update",
  subject: (vars) => `Shipping update for order ${liquidValue(vars.order_name)}`,
  render: (vars) => (
    <EmailDocument
      preview={`Tracking information for order ${liquidValue(vars.order_name)} has changed.`}
      title="Your delivery estimate has changed"
    >
      <EmailHeader eyebrow="SHIPPING UPDATE" />
      <EmailTitle>Your delivery estimate has changed</EmailTitle>
      <EmailLead>Here’s where these items stand now.</EmailLead>
      <If test={isTruthy(vars.fulfillment.estimated_delivery_at)}>
        <EmailLead>
          Estimated delivery date:{" "}
          <Var filters={["date: format: 'date'"]} path={vars.fulfillment.estimated_delivery_at} />
        </EmailLead>
      </If>
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
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(shippingUpdate)
