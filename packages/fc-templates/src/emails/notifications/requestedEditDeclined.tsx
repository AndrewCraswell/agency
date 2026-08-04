import { definePreview, defineTemplate, For, If, isPresent, liquidValue, pathOf, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

export const requestedEditDeclined = defineTemplate({
  type: "requested_edit_declined",
  subject: (vars) => `Your cancellation request for order ${liquidValue(vars.order_name)} was declined`,
  render: (vars) => (
    <EmailDocument
      preview="We couldn’t cancel these items. Here’s why, and what happens next."
      title="Your cancellation request was declined"
    >
      <EmailHeader eyebrow="REQUEST DECLINED" />
      <EmailTitle>Your cancellation request was declined</EmailTitle>
      <EmailLead>
        Hi <Var filters={["default: 'there'"]} path={vars.customer.first_name} />, we’ve reviewed your cancellation
        request for order <Var path={vars.order_name} />
        <If test={isPresent(vars.po_number)}>
          {" "}
          (PO <Var path={vars.po_number} />)
        </If>{" "}
        and we aren’t able to accept it.
      </EmailLead>
      <If test={isPresent(vars.requested_edit.decline_note)}>
        <HelpCard headline="Why we declined it" kicker="FROM OUR TEAM">
          <Var path={vars.requested_edit.decline_note} />
        </HelpCard>
      </If>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <ItemList label="CANCELLATION REQUEST SUMMARY">
        <For each={vars.requested_edit.affected_line_items}>
          {/* A requested edit lists variants, so `title` is blank and only the variant names the product. */}
          {(line) => (
            <ItemRow
              free
              line={line}
              title={<Var filters={[`default: ${pathOf(line.variant.product.title)}`]} path={line.title} />}
              variantTitle={line.variant.title}
            />
          )}
        </For>
      </ItemList>
      <SupportBand heading="Still need to change this order?">
        Reply to this email as soon as you can and we’ll see what’s possible.
      </SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(requestedEditDeclined)
