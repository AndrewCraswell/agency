import { definePreview, defineTemplate, For, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

export const returnDeclined = defineTemplate({
  type: "return_declined",
  subject: (vars) => `Your return request for order ${liquidValue(vars.order_name)} was declined`,
  render: (vars) => (
    <EmailDocument
      preview="We couldn’t accept this return. Here’s why, and what you can do next."
      title="Your return request was declined"
    >
      <EmailHeader eyebrow="RETURN DECLINED" />
      <EmailTitle>Your return request was declined</EmailTitle>
      <EmailLead>
        Hi <Var filters={["default: 'there'"]} path={vars.customer.first_name} />, we’ve reviewed your return request
        for order <Var path={vars.order_name} />
        <If test={isPresent(vars.po_number)}>
          {" "}
          (PO <Var path={vars.po_number} />)
        </If>{" "}
        and we aren’t able to accept it.
      </EmailLead>
      {/* `decline` is a hash in Liquid, and `note` is the only key it is ever asked for. */}
      <If test={isPresent(vars.return.decline.note)}>
        <HelpCard headline="Why we declined it" kicker="FROM OUR TEAM">
          <Var path={vars.return.decline.note} />
        </HelpCard>
      </If>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <ItemList label="RETURN SUMMARY">
        <For each={vars.return.line_items}>
          {(line) => <ItemRow free line={line} variantTitle={line.variant_title} />}
        </For>
      </ItemList>
      <SupportBand heading="Think this was a mistake?">
        Reply to this email and we’ll take another look with you.
      </SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(returnDeclined)
