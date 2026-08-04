import {
  and,
  definePreview,
  defineTemplate,
  Else,
  For,
  If,
  isPresent,
  liquidValue,
  pathOf,
  Var
} from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

/*
 * One message covers a cancellation, a return, or both at once, and it has to name what the
 * customer actually asked for. Both requests together are deliberately not called either one,
 * because each is answered separately later.
 */

export const changeRequested = defineTemplate({
  type: "change_requested",
  subject: (vars) => `Your request for order ${liquidValue(vars.order_name)} was sent`,
  render: (vars) => (
    <EmailDocument preview="We’ve got your request and we’re reviewing it now." title="Your request was sent">
      <EmailHeader eyebrow="REQUEST SENT" />
      <If test={and(isPresent(vars.requested_edit), isPresent(vars.return))}>
        <EmailTitle>Your request was sent</EmailTitle>
        <Else>
          <If test={isPresent(vars.requested_edit)}>
            <EmailTitle>Your cancellation request was sent</EmailTitle>
            <Else>
              <EmailTitle>Your return request was sent</EmailTitle>
            </Else>
          </If>
        </Else>
      </If>
      <EmailLead>
        Hi <Var filters={["default: 'there'"]} path={vars.customer.first_name} />, your request for order{" "}
        <Var path={vars.order_name} />
        <If test={isPresent(vars.po_number)}>
          {" "}
          (PO <Var path={vars.po_number} />)
        </If>{" "}
        is being reviewed.{" "}
        <If test={and(isPresent(vars.requested_edit), isPresent(vars.return))}>
          You’ll get a separate email for each request as it’s completed.
          <Else>We’ll email you once it’s been completed.</Else>
        </If>
      </EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <EmailButton href={liquidValue(vars.shop.url)} spacing={12} variant="secondary">
        Visit our store
      </EmailButton>
      <If test={isPresent(vars.requested_edit)}>
        <ItemList label="CANCELLATION REQUEST SUMMARY">
          <For each={vars.requested_edit.line_items}>
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
      </If>
      <If test={isPresent(vars.return)}>
        <ItemList label="RETURN REQUEST SUMMARY">
          <For each={vars.return.line_items}>
            {(line) => <ItemRow free line={line} variantTitle={line.variant_title} />}
          </For>
        </ItemList>
      </If>
      <SupportBand heading="Need to change something else?">
        Reply to this email and we’ll sort it out together.
      </SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(changeRequested)
