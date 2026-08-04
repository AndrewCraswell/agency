import { definePreview, defineTemplate, For, liquidValue, pathOf, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { Totals, TotalsRow, TotalsSum } from "../components/Totals.tsx"

/*
 * An exchange is two movements, so it lists what came back and what went out separately and lets
 * the ledger reconcile them. A return line repeats its variant in `title`, hence the plainer name.
 */
export const posExchangeV2Receipt = defineTemplate({
  type: "pos_exchange_v2_receipt",
  subject: () => "Items exchanged",
  render: (vars) => (
    <EmailDocument
      preview="Here’s a summary of your in-store exchange, including what you returned and the new items you took home."
      title="Your exchange is complete"
    >
      <EmailHeader eyebrow="EXCHANGE RECEIPT" />
      <EmailTitle>Your exchange is complete</EmailTitle>
      <EmailLead>
        Here’s a summary of your in-store exchange for order <Var path={vars.order.name} />, processed at the counter.
      </EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <ItemList label="RETURNED">
        <For each={vars.return_line_items}>
          {(line) => (
            <ItemRow
              credit
              line={line}
              title={<Var filters={[`default: ${pathOf(line.title)}`]} path={line.title_without_variant} />}
              variantTitle={line.variant.title}
            />
          )}
        </For>
      </ItemList>
      <ItemList label="NEW ITEMS">
        <For each={vars.added_line_items}>
          {(line) => (
            <ItemRow
              line={line}
              title={<Var filters={[`default: ${pathOf(line.title)}`]} path={line.title_without_variant} />}
              variantTitle={line.variant.title}
            />
          )}
        </For>
      </ItemList>
      <Totals>
        <TotalsRow credit label="Return credit">
          −<Var filters={["money"]} path={vars.return_total} />
        </TotalsRow>
        <TotalsRow label="New items">
          <Var filters={["money"]} path={vars.added_total} />
        </TotalsRow>
        <TotalsSum label="Balance paid today">
          <Var filters={["money"]} path={vars.exchange_total} />
        </TotalsSum>
      </Totals>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(posExchangeV2Receipt)
