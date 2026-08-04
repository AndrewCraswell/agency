import { and, Assign, binding, eq, For, gt, If, type PathRef, pathOf, Var } from "@repo/shopify-emails"
import { TotalsRow } from "./Totals.tsx"

/*
 * Shopify hands `subtotal_price` already net of every discount, whether the discount named lines or
 * the whole order. The lines above the ladder explain their own reductions, so only an order-wide
 * one is still unaccounted for here: add it back into the subtotal and then name it on its own row,
 * which is the only arrangement where the column adds up to the total Shopify charged. A shipping
 * discount is the exception, because it came off the shipping row rather than the goods.
 */

export type OrderDiscountRef = {
  readonly discount_applications: PathRef<
    readonly {
      readonly target_selection: string
      readonly target_type: string
      readonly title: string
      readonly total_allocated_amount: number
    }[]
  >
  readonly subtotal_price: PathRef<number>
}

const goodsWideTotal = binding<number>("order_wide_goods_discount")
const orderWideCount = binding<number>("order_wide_discount_count")

/** Sums what the subtotal has to give back, and counts the rows that will name it. */
export const OrderWideDiscount = ({ order }: { readonly order: OrderDiscountRef }) => (
  <>
    <Assign to={goodsWideTotal} value="0" />
    <Assign to={orderWideCount} value="0" />
    <For each={order.discount_applications}>
      {(discount) => (
        <If test={eq(discount.target_selection, "all")}>
          <Assign to={orderWideCount} value={`${pathOf(orderWideCount)} | plus: 1`} />
          <If test={eq(discount.target_type, "line_item")}>
            <Assign
              to={goodsWideTotal}
              value={`${pathOf(goodsWideTotal)} | plus: ${pathOf(discount.total_allocated_amount)}`}
            />
          </If>
        </If>
      )}
    </For>
  </>
)

export const SubtotalRow = ({ order }: { readonly order: OrderDiscountRef }) => (
  <TotalsRow label="Subtotal">
    <Var filters={[`plus: ${pathOf(goodsWideTotal)}`, "money"]} path={order.subtotal_price} />
  </TotalsRow>
)

/* Named one by one where there are several, because "Discount" twice reads as a mistake. */
export const OrderDiscountRows = ({ order }: { readonly order: OrderDiscountRef }) => (
  <If test={gt(orderWideCount, 0)}>
    <For each={order.discount_applications}>
      {(discount) => (
        <If test={and(eq(discount.target_selection, "all"), gt(discount.total_allocated_amount, 0))}>
          <TotalsRow credit label={<Var filters={["default: 'Discount'"]} path={discount.title} />}>
            −<Var filters={["money"]} path={discount.total_allocated_amount} />
          </TotalsRow>
        </If>
      )}
    </For>
  </If>
)
