import { and, For, If, isTruthy, liquidValue, neq, type PathRef, Var } from "@repo/shopify-emails"
import type { ReactNode } from "react"
import { Column, Img, Row, Section } from "react-email"
import { color, font, gutter } from "./tokens.ts"

/*
 * One purchased line: thumbnail, what it was, and what it cost. The rule sits on the row rather
 * than between rows so a loop can emit it without knowing where it stopped.
 *
 * The row takes the line's path rather than rendered nodes. Whether there is an image or a
 * markdown is Liquid's to decide at send time, so the row emits the conditions itself; handing it
 * nodes would let a caller forget one and leave an empty thumbnail on every line.
 */

export type ItemListProps = {
  /** A band heading such as `ITEMS IN DELIVERY`, for the notifications that ship part of an order. */
  readonly label?: ReactNode
  readonly children: ReactNode
}

export const ItemList = ({ children, label }: ItemListProps) => (
  <Section className="px" style={{ padding: `24px ${gutter}px 0` }}>
    {label === undefined ? null : (
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "1.5px",
          lineHeight: "16px",
          paddingBottom: 8
        }}
      >
        {label}
      </div>
    )}
    {children}
  </Section>
)

/* The shape Shopify gives every purchased line, in the notifications that list what was bought. */
export type LineItem = {
  readonly title: string
  readonly image: string | null
  readonly quantity: number
  readonly original_line_price: number
  readonly final_line_price: number
  readonly discount_allocations: readonly {
    readonly amount: number
    readonly discount_application: { readonly title: string }
  }[]
}

export type ItemRowProps = {
  readonly line: PathRef<LineItem>
  /* An order line nests its variant; a point-of-sale line spells the title out flat beside it. */
  readonly variantTitle: PathRef<string>
  /* A shipment may carry part of a line, so fulfillment counts its own quantity beside the item. */
  readonly quantity?: PathRef<number>
  /* A return line repeats its variant in `title`, so an exchange names the product another way. */
  readonly title?: ReactNode
  /** A line going back to us, whose price is money returned rather than money charged. */
  readonly credit?: boolean
}

export const ItemRow = ({
  credit = false,
  line,
  quantity = line.quantity,
  title = <Var path={line.title} />,
  variantTitle
}: ItemRowProps) => (
  <Row className="dk-border" style={{ borderBottom: `1px solid ${color.line}` }}>
    <Column style={{ padding: "12px 0", verticalAlign: "top", width: 48 }}>
      {/* The grey square is always drawn, so a line without a picture still lines up with one. */}
      <div
        className="dk-surface dk-border"
        style={{
          backgroundColor: color.surface,
          border: `1px solid ${color.line}`,
          borderRadius: 8,
          height: 48,
          width: 48
        }}
      >
        <If test={isTruthy(line.image)}>
          <Img
            alt=""
            height={48}
            src={liquidValue(line.image)}
            style={{ borderRadius: 8, display: "block" }}
            width={48}
          />
        </If>
      </div>
    </Column>
    <Column style={{ padding: "12px 0 12px 12px", verticalAlign: "top" }}>
      <div
        className="dk-text"
        style={{ color: color.ink, fontFamily: font.body, fontSize: 14, fontWeight: 600, lineHeight: "19px" }}
      >
        {title}
      </div>
      {/* Shopify names a single-variant product's only variant `Default Title`. */}
      <If test={and(isTruthy(variantTitle), neq(variantTitle, "Default Title"))}>
        <ItemVariant>
          <Var path={variantTitle} />
        </ItemVariant>
      </If>
      <For each={line.discount_allocations}>
        {(allocation) => (
          <ItemDiscount>
            <Var path={allocation.discount_application.title} /> −
            <Var filters={["money"]} path={allocation.amount} />
          </ItemDiscount>
        )}
      </For>
    </Column>
    <Column align="right" style={{ padding: "12px 0 12px 10px", textAlign: "right", verticalAlign: "top" }}>
      <div
        className="dk-muted"
        style={{ color: color.inkSoft, fontFamily: font.body, fontSize: 12, fontWeight: 400, lineHeight: "17px" }}
      >
        Qty <Var path={quantity} />
      </div>
      <If test={neq(line.original_line_price, line.final_line_price)}>
        <ItemComparePrice>
          <Var filters={["money"]} path={line.original_line_price} />
        </ItemComparePrice>
      </If>
      <div
        className="dk-text"
        style={{
          color: color.ink,
          fontFamily: font.body,
          fontSize: 14,
          fontWeight: 600,
          lineHeight: "19px",
          paddingTop: 2
        }}
      >
        {credit ? "−" : null}
        <Var filters={["money"]} path={line.final_line_price} />
      </div>
    </Column>
  </Row>
)

type ItemNoteProps = {
  readonly children: ReactNode
}

/** The variant line under a title, such as `Size 8 / Right-hand`. */
const ItemVariant = ({ children }: ItemNoteProps) => (
  <div
    className="dk-muted"
    style={{
      color: color.inkSoft,
      fontFamily: font.body,
      fontSize: 12,
      fontWeight: 400,
      lineHeight: "17px",
      paddingTop: 3
    }}
  >
    {children}
  </div>
)

/** A discount that applied to this line, named and priced in the green the design reserves for it. */
const ItemDiscount = ({ children }: ItemNoteProps) => (
  <div
    style={{
      color: color.paid,
      fontFamily: font.body,
      fontSize: 11.5,
      fontWeight: 600,
      lineHeight: "16px",
      paddingTop: 3
    }}
  >
    {children}
  </div>
)

/** What the line would have cost, struck through above what it did. */
const ItemComparePrice = ({ children }: ItemNoteProps) => (
  <div
    className="dk-muted"
    style={{
      color: color.inkSoft,
      fontFamily: font.body,
      fontSize: 12,
      fontWeight: 400,
      lineHeight: "17px",
      paddingTop: 2,
      textDecoration: "line-through"
    }}
  >
    {children}
  </div>
)
