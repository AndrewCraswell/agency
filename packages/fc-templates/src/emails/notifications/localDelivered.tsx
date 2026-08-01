import { definePreview, defineTemplate, For, liquidValue } from "@repo/shopify-emails"
import { Link } from "react-email"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow, presentedTitle } from "../components/ItemRow.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { color, shopLinks } from "../components/tokens.ts"

export const localDelivered = defineTemplate({
  type: "local_delivered",
  subject: (vars) => `Order ${liquidValue(vars.order_name)} has been delivered`,
  render: (vars) => (
    <EmailDocument
      preview={`Order ${liquidValue(vars.order_name)} has been delivered by our local courier.`}
      title="Your order has been delivered"
    >
      <EmailHeader eyebrow="DELIVERED" />
      <EmailTitle>Your order has been delivered</EmailTitle>
      <EmailLead>
        Haven’t received your order?{" "}
        <Link href={shopLinks.contact} style={{ color: color.ink, textDecoration: "underline" }}>
          Let us know
        </Link>
        .
      </EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <ItemList label="ITEMS DELIVERED">
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
        If anything arrived damaged or wasn’t what you expected, our team will make it right. Just reply to this email.
      </SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(localDelivered)
