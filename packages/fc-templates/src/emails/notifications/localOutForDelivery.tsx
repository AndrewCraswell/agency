import { definePreview, defineTemplate, For, If, isTruthy, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"

/* Our own courier carries this one, so there is no carrier or consignment number to show. */
export const localOutForDelivery = defineTemplate({
  type: "local_out_for_delivery",
  subject: (vars) => `Order ${liquidValue(vars.order_name)} is out for delivery`,
  render: (vars) => (
    <EmailDocument
      preview={`Order ${liquidValue(vars.order_name)} is out for local delivery and should arrive today.`}
      title="Your order is out for delivery"
    >
      <EmailHeader eyebrow="OUT FOR DELIVERY" />
      <EmailTitle>Your order is out for delivery</EmailTitle>
      <EmailLead>Your order is on its way and will arrive soon.</EmailLead>
      <If test={isTruthy(vars.fulfillment.estimated_delivery_at)}>
        <EmailLead>
          Estimated delivery date:{" "}
          <Var filters={["date: format: 'date'"]} path={vars.fulfillment.estimated_delivery_at} />
        </EmailLead>
      </If>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <ItemList label="ITEMS IN DELIVERY">
        <For each={vars.fulfillment.fulfillment_line_items}>
          {(line) => (
            <ItemRow line={line.line_item} quantity={line.quantity} variantTitle={line.line_item.variant.title} />
          )}
        </For>
      </ItemList>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(localOutForDelivery)
