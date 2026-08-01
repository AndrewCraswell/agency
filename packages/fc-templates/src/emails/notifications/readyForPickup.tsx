import { definePreview, defineTemplate, For, liquidValue, Var } from "@repo/shopify-emails"
import { AddressBlock } from "../components/AddressBlock.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

/* Pickup orders are named `name`, not `order_name`: Shopify only renames it for fulfillments. */
export const readyForPickup = defineTemplate({
  type: "ready_for_pickup",
  subject: (vars) => `Order ${liquidValue(vars.name)} is ready for pickup`,
  render: (vars) => (
    <EmailDocument
      preview={`Order ${liquidValue(vars.name)} is packed and waiting at ${liquidValue(vars.location_name, ["default: shop.name"])}.`}
      title="Your order is ready for pickup"
    >
      <EmailHeader eyebrow="READY FOR PICKUP" />
      <EmailTitle>Your order is ready for pickup</EmailTitle>
      <EmailLead>
        Order <Var path={vars.name} /> is packed and waiting at{" "}
        <Var filters={["default: shop.name"]} path={vars.location_name} />. Bring a photo ID and this email when you
        come by.
      </EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url)}>View pickup details</EmailButton>
      <AddressBlock
        headline={<Var filters={["default: shop.name"]} path={vars.location_name} />}
        kicker="PICKUP LOCATION"
      >
        <div>
          <Var path={vars.shop.address.address1} />
        </div>
        <div>
          <Var path={vars.shop.address.city} />, <Var path={vars.shop.address.province} />{" "}
          <Var path={vars.shop.address.zip} />
        </div>
      </AddressBlock>
      <ItemList label="ORDER SUMMARY">
        <For each={vars.line_items}>{(line) => <ItemRow line={line} variantTitle={line.variant_title} />}</For>
      </ItemList>
      <SupportBand>Our team replies fast. Just reply to this email or reach us anytime.</SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(readyForPickup)
