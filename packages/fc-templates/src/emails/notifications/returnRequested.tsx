import { definePreview, defineTemplate, For, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

export const returnRequested = defineTemplate({
  type: "return_requested",
  subject: (vars) => `Your return request for order ${liquidValue(vars.order_name)} was sent`,
  render: (vars) => (
    <EmailDocument
      preview="We’ve got your return request and we’re reviewing it now."
      title="Your return request was sent"
    >
      <EmailHeader eyebrow="RETURN REQUESTED" />
      <EmailTitle>Your return request was sent</EmailTitle>
      <EmailLead>
        Hi <Var filters={["default: 'there'"]} path={vars.customer.first_name} />, your return request for order{" "}
        <Var path={vars.order_name} />
        {/* A purchase order number is a B2B field, so most orders carry none. */}
        <If test={isPresent(vars.po_number)}>
          {" "}
          (PO <Var path={vars.po_number} />)
        </If>{" "}
        was sent and is being reviewed. We’ll email you once it’s been completed.
      </EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <EmailButton href={liquidValue(vars.shop.url)} spacing={12} variant="secondary">
        Visit our store
      </EmailButton>
      <ItemList label="RETURN SUMMARY">
        <For each={vars.return.line_items}>
          {(line) => <ItemRow credit free line={line} variantTitle={line.variant_title} />}
        </For>
      </ItemList>
      <SupportBand heading="Questions about your return?">
        Reply to this email and we’ll pick it up from here.
      </SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(returnRequested)
