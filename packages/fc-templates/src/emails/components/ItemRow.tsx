import {
  and,
  Assign,
  binding,
  Else,
  For,
  gt,
  If,
  isPresent,
  isTruthy,
  liquidExpression,
  liquidValue,
  neq,
  type PathRef,
  pathOf,
  Var
} from "@repo/shopify-emails"
import type { ReactNode } from "react"
import { Column, Img, Row, Section } from "react-email"
import { color, font, gutter, sectionGap } from "./tokens.ts"

/*
 * One purchased line: thumbnail, what it was, and what it cost. The rule sits on the row rather
 * than between rows so a loop can emit it without knowing where it stopped.
 *
 * How many were bought is a badge on the thumbnail rather than a figure in the money column. At a
 * quantity of one the extended price equals the unit price, so a money column that carried both
 * printed the same number twice, and a discounted line printed three.
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
  <Section className="px" style={{ padding: `${sectionGap}px ${gutter}px 0` }}>
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
  /** What the buyer saw at checkout, which a translated storefront makes differ from `title`. */
  readonly presentment_title: string | null
  readonly image: string | null
  readonly quantity: number
  /** One of them, which the row prints beside `each` once the buyer took more than one. */
  readonly price: number
  readonly original_line_price: number
  readonly final_line_price: number
  /** A bundle the line belongs to, or the parcel it was split into. Empty for an ordinary line. */
  readonly groups: readonly {
    readonly "deliverable?": boolean
    readonly title: string
  }[]
  readonly discount_allocations: readonly {
    readonly amount: number
    readonly discount_application: {
      readonly title: string
      /** `all` means the whole order was discounted, which the totals ladder names instead. */
      readonly target_selection: string
    }
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
  /** Write a nil price as `Free`, which only the carts and the returns designs ask for. */
  readonly free?: boolean
  /** An `ItemBadge` saying what happened to this line, on the notices that change part of an order. */
  readonly badge?: ReactNode
}

/** What the buyer saw at checkout, which the shipping designs print in place of the internal title. */
export const presentedTitle = (line: PathRef<LineItem>) => (
  <Var filters={[`default: ${pathOf(line.title)}`]} path={line.presentment_title} />
)

/*
 * A line's own discounts are the only ones it may announce, so its price is the list price less
 * those. Working down from the original rather than up from `final_line_price` also keeps the
 * struck price above the live one, which adding back an order-wide share could not guarantee.
 */
const lineOwnDiscount = binding<number>("line_own_discount")
const shownLinePrice = binding<number>("line_shown_price")

export const ItemRow = ({
  badge,
  credit = false,
  free = false,
  line,
  quantity = line.quantity,
  title = <Var path={line.title} />,
  variantTitle
}: ItemRowProps) => (
  <Row className="dk-border" style={{ borderBottom: `1px solid ${color.line}` }}>
    {/* 9px wider than the thumbnail and 9px shorter above it, which is what the badge hangs over. */}
    <Column style={{ padding: "3px 0 12px", verticalAlign: "middle", width: 59 }}>
      {/* Shopify's email pipeline strips CSS background images, so the picture has to be an img.
          The grey square behind it is always drawn, to keep a line without one lined up. It comes
          first because an image and the badge both paint as inline content, in document order. */}
      <div style={{ fontSize: 0, height: 0, lineHeight: 0 }}>
        <div
          className="dk-surface dk-border"
          style={{
            backgroundColor: color.surface,
            border: `1px solid ${color.line}`,
            borderRadius: 8,
            display: "inline-block",
            fontSize: 0,
            height: 48,
            lineHeight: 0,
            marginTop: 9,
            width: 48
          }}
        >
          <If test={isPresent(line.image)}>
            {/* The raw drop is a store-relative path, so only `img_url` yields a URL an email client can fetch. */}
            <Img
              alt=""
              height={48}
              src={liquidValue(line.image, ["img_url: '96x96'"])}
              style={{ borderRadius: 8, display: "block", objectFit: "cover" }}
              width={48}
            />
          </If>
        </div>
      </div>
      {/* Gmail drops both `position` and a negative margin, so the badge cannot be pulled back over
          the corner. The thumbnail above holds no height, so this strip starts level with its top. */}
      <div style={{ fontSize: 0, height: 57, lineHeight: 0, textAlign: "right" }}>
        <div
          className="dk-chip dk-ring"
          style={{
            backgroundColor: color.ink,
            border: `1px solid ${color.bg}`,
            borderRadius: 9,
            color: color.onDark,
            display: "inline-block",
            fontFamily: font.body,
            fontSize: 10,
            fontWeight: 700,
            height: 16,
            lineHeight: "16px",
            textAlign: "center",
            verticalAlign: "top",
            width: 16
          }}
        >
          <Var path={quantity} />
        </div>
      </div>
    </Column>
    {/* The 20px gap to the thumbnail, less the 9px the column beside it took for the badge. */}
    <Column style={{ padding: "12px 0 12px 11px", verticalAlign: "middle" }}>
      <Assign to={lineOwnDiscount} value="0" />
      <For each={line.discount_allocations}>
        {(allocation) => (
          <If test={neq(allocation.discount_application.target_selection, "all")}>
            <Assign to={lineOwnDiscount} value={`${pathOf(lineOwnDiscount)} | plus: ${pathOf(allocation.amount)}`} />
          </If>
        )}
      </For>
      <Assign to={shownLinePrice} value={`${pathOf(line.original_line_price)} | minus: ${pathOf(lineOwnDiscount)}`} />
      <div
        className="dk-text"
        style={{ color: color.ink, fontFamily: font.body, fontSize: 14, fontWeight: 600, lineHeight: "19px" }}
      >
        {title}
      </div>
      {badge}
      {/* Shopify names a single-variant product's only variant `Default Title`. */}
      <If test={and(isTruthy(variantTitle), neq(variantTitle, "Default Title"))}>
        <ItemNote>
          <Var path={variantTitle} />
        </ItemNote>
      </If>
      <For each={line.groups}>
        {(group) => (
          <ItemNote>
            <If test={isTruthy(group["deliverable?"])}>
              For:
              <Else>Part of:</Else>
            </If>{" "}
            <Var path={group.title} />
          </ItemNote>
        )}
      </For>
      {/* What one costs, which only earns its line once the buyer took more than one. A requested
          edit lists variants rather than order lines, and leaves the price blank. */}
      <If test={and(gt(quantity, 1), isPresent(line.price))}>
        <ItemNote>
          <Var filters={["money"]} path={line.price} /> each
        </ItemNote>
      </If>
      <For each={line.discount_allocations}>
        {(allocation) => (
          <If test={neq(allocation.discount_application.target_selection, "all")}>
            <ItemDiscount>
              <Var filters={["default: 'Discount'"]} path={allocation.discount_application.title} /> (−
              <Var filters={["money"]} path={allocation.amount} />)
            </ItemDiscount>
          </If>
        )}
      </For>
    </Column>
    <Column align="right" style={{ padding: "12px 0 12px 20px", textAlign: "right", verticalAlign: "middle" }}>
      <If test={neq(line.original_line_price, shownLinePrice)}>
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
        {free ? (
          <If test={gt(shownLinePrice, 0)}>
            <Var filters={["money"]} path={shownLinePrice} />
            <Else>Free</Else>
          </If>
        ) : (
          <Var filters={["money"]} path={shownLinePrice} />
        )}
      </div>
    </Column>
  </Row>
)

type ItemNoteProps = {
  readonly children: ReactNode
}

/** A quiet line under the title: the variant, the bundle it belongs to, or what one of them cost. */
const ItemNote = ({ children }: ItemNoteProps) => (
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
    {/* Shopify serves the tag its own notifications put beside a discount. */}
    <Img
      alt=""
      height={13}
      src={liquidExpression("'notifications/discounttag.png' | shopify_asset_url")}
      style={{ display: "inline-block", marginRight: 5, verticalAlign: "-2px" }}
      width={13}
    />
    {children}
  </div>
)

/*
 * A pill rather than another quiet note, so that a line whose state changed is picked out on sight.
 * Exported so a caller can put it inside its own condition: the box has to disappear with the text,
 * and a Liquid condition resolves too late for this component to see that it came out empty.
 */
export const ItemBadge = ({ children }: ItemNoteProps) => (
  <div style={{ paddingTop: 5 }}>
    <span
      className="dk-surface dk-muted"
      style={{
        backgroundColor: color.surface,
        borderRadius: 4,
        color: color.inkSoft,
        display: "inline-block",
        fontFamily: font.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.8px",
        lineHeight: "14px",
        padding: "2px 7px"
      }}
    >
      {children}
    </span>
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
