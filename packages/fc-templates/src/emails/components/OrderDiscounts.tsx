import { Assign, binding, eq, For, gt, If, type PathRef, pathOf, Var } from "@repo/shopify-emails"
import { TotalsRow } from "./Totals.tsx"

/*
 * Shopify hands `subtotal_price` already net of every discount, whether the discount named lines or
 * the whole order. The lines above the ladder explain their own reductions, so only an order-wide
 * one is still unaccounted for here: add it back into the subtotal and then name it on its own row,
 * which is the only arrangement where the column adds up to the total Shopify charged.
 */

export type OrderDiscountRef = {
  readonly discount_applications: PathRef<
    readonly {
      readonly target_selection: string
      readonly title: string
      readonly total_allocated_amount: number
    }[]
  >
  readonly subtotal_price: PathRef<number>
}

const orderWideTotal = binding<number>("order_wide_discount")

/** Sums the order-wide discounts, which both the subtotal and the discount rows need. */
export const OrderWideDiscount = ({ order }: { readonly order: OrderDiscountRef }) => (
  <>
    <Assign to={orderWideTotal} value="0" />
    <For each={order.discount_applications}>
      {(discount) => (
        <If test={eq(discount.target_selection, "all")}>
          <Assign
            to={orderWideTotal}
            value={`${pathOf(orderWideTotal)} | plus: ${pathOf(discount.total_allocated_amount)}`}
          />
        </If>
      )}
    </For>
  </>
)

export const SubtotalRow = ({ order }: { readonly order: OrderDiscountRef }) => (
  <TotalsRow label="Subtotal">
    <Var filters={[`plus: ${pathOf(orderWideTotal)}`, "money"]} path={order.subtotal_price} />
  </TotalsRow>
)

/* Named one by one where there are several, because "Discount" twice reads as a mistake. */
export const OrderDiscountRows = ({ order }: { readonly order: OrderDiscountRef }) => (
  <If test={gt(orderWideTotal, 0)}>
    <For each={order.discount_applications}>
      {(discount) => (
        <If test={eq(discount.target_selection, "all")}>
          <TotalsRow credit label={<Var filters={["default: 'Discount'"]} path={discount.title} />}>
            −<Var filters={["money"]} path={discount.total_allocated_amount} />
          </TotalsRow>
        </If>
      )}
    </For>
  </If>
)
