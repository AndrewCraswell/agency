import { and, Else, For, gt, If, isPresent, neq, type PathRef, type ReturnDrop, Var } from "@repo/shopify-emails"
import { Totals, TotalsRow, TotalsSum } from "./Totals.tsx"

/*
 * What a return comes to. Every figure is an estimate until the items arrive, so the closing line
 * says so, and it says either what is still owed or what is coming back — never both.
 *
 * The subtotal is already negative where the return credits the customer, so it is printed as it
 * comes rather than behind a minus sign the way an order discount is.
 */

export type ReturnTotalsProps = {
  readonly returned: PathRef<ReturnDrop>
}

export const ReturnTotals = ({ returned }: ReturnTotalsProps) => (
  <Totals>
    <TotalsRow label="Subtotal">
      <Var filters={["money"]} path={returned.line_items_subtotal_price} />
    </TotalsRow>
    {/* A restocking or return-shipping charge. Missing it is what generates a support ticket. */}
    <For each={returned.fees}>
      {(fee) => (
        <TotalsRow label={<Var path={fee.title} />}>
          <Var filters={["money"]} path={fee.subtotal} />
        </TotalsRow>
      )}
    </For>
    <If test={isPresent(returned.total_tax_price)}>
      <TotalsRow label="Estimated taxes">
        <Var filters={["money"]} path={returned.total_tax_price} />
      </TotalsRow>
    </If>
    <If
      test={and(
        isPresent(returned.pre_return_order_total_outstanding),
        neq(returned.pre_return_order_total_outstanding, 0)
      )}
    >
      <TotalsRow label="Outstanding balance">
        <Var filters={["money_with_currency"]} path={returned.pre_return_order_total_outstanding} />
      </TotalsRow>
    </If>
    <If test={gt(returned.order_total_outstanding, 0)}>
      <TotalsSum label="Estimated amount to pay">
        <Var filters={["money_with_currency"]} path={returned.order_total_outstanding} />
      </TotalsSum>
      <Else>
        <TotalsSum label="Estimated refund">
          <Var filters={["abs", "money_with_currency"]} path={returned.order_total_outstanding} />
        </TotalsSum>
      </Else>
    </If>
  </Totals>
)
