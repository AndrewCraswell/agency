import { definePreview, defineTemplate, For, liquidValue, Var } from "@repo/shopify-emails"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"
import { ItemList, ItemRow, presentedTitle } from "../components/ItemRow.tsx"
import { OrderActions } from "../components/OrderActions.tsx"

export const localMissedDelivery = defineTemplate({
  type: "local_missed_delivery",
  subject: (vars) => `We missed you with order ${liquidValue(vars.order_name)}`,
  render: (vars) => (
    <EmailDocument
      preview={`We tried to deliver order ${liquidValue(vars.order_name)} but no one was available to receive it.`}
      title="Sorry we missed you"
    >
      <EmailHeader eyebrow="DELIVERY MISSED" />
      <EmailTitle>Sorry we missed you</EmailTitle>
      <EmailLead>
        Hi <Var path={vars.customer.first_name} />, we came by but no one was there to take the delivery.
      </EmailLead>
      {/* The order page carries the reschedule conversation; a shop with no order link falls back home. */}
      <OrderActions
        href={liquidValue(vars.order_status_url, ["default: shop.url"])}
        shopUrl={vars.shop_app_tracking_url}
        shopVariantKey={vars.shop_app_tracking_button_variant_key}
      >
        Contact us to reschedule
      </OrderActions>
      <ItemList label="ITEMS IN THIS DELIVERY">
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
      <HelpCard headline="Arrange another delivery" kicker="NEXT STEPS">
        Reply to this email or contact our team and we’ll schedule a new delivery time that works for you.
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(localMissedDelivery)
