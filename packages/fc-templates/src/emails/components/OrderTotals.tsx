import { Else, gt, If, isTruthy, type PathRef, Var } from "@repo/shopify-emails"
import type { ReactNode } from "react"
import { OrderDiscountRows, OrderWideDiscount, SubtotalRow } from "./OrderDiscounts.tsx"
import { Totals, TotalsRow, TotalsSum } from "./Totals.tsx"

/*
 * The order ledger the three change notifications share. A confirmation states one arithmetic and
 * can spell it out inline; these three restate an order the customer has already read, so the rows
 * have to agree between them exactly or the reader is left doing the subtraction themselves.
 *
 * Anything settled after the total — what was paid, what went back — arrives as children, because
 * only the sending template knows whether there is one.
 */

export type OrderTotalsRef = {
  readonly discount_applications: PathRef<
    readonly {
      readonly target_selection: string
      readonly title: string
      readonly total_allocated_amount: number
    }[]
  >
  readonly discounts_amount: PathRef<number>
  readonly requires_shipping: PathRef<boolean>
  readonly shipping_price: PathRef<number>
  readonly subtotal_price: PathRef<number>
  readonly tax_price: PathRef<number>
  readonly total_duties: PathRef<number>
  readonly total_price: PathRef<number>
  readonly total_tip: PathRef<number>
}

export type OrderTotalsProps = {
  readonly order: OrderTotalsRef
  /** Rows that settle the total rather than build it, such as what was paid or refunded. */
  readonly children?: ReactNode
}

export const OrderTotals = ({ children, order }: OrderTotalsProps) => (
  <Totals>
    <OrderWideDiscount order={order} />
    <SubtotalRow order={order} />
    <OrderDiscountRows order={order} />
    <If test={isTruthy(order.requires_shipping)}>
      <TotalsRow label="Shipping">
        <If test={gt(order.shipping_price, 0)}>
          <Var filters={["money"]} path={order.shipping_price} />
          <Else>Free</Else>
        </If>
      </TotalsRow>
    </If>
    <If test={gt(order.total_duties, 0)}>
      <TotalsRow label="Duties">
        <Var filters={["money"]} path={order.total_duties} />
      </TotalsRow>
    </If>
    <If test={gt(order.tax_price, 0)}>
      <TotalsRow label="Taxes">
        <Var filters={["money"]} path={order.tax_price} />
      </TotalsRow>
    </If>
    <If test={gt(order.total_tip, 0)}>
      <TotalsRow label="Tip">
        <Var filters={["money"]} path={order.total_tip} />
      </TotalsRow>
    </If>
    <TotalsSum>
      <Var filters={["money"]} path={order.total_price} />
    </TotalsSum>
    {children}
  </Totals>
)
