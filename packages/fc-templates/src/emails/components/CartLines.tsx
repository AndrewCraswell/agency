import { For, gt, If, isPresent, isTruthy, liquidValue, type PathRef, Var } from "@repo/shopify-emails"
import { Column, Img, Row, Section } from "react-email"
import { color, font } from "./tokens.ts"

/*
 * A line the shopper added and did not buy. An abandonment carries no money, so this is the item
 * row without its price column rather than `ItemRow` with everything monetary made optional.
 */
export type CartLine = {
  readonly title: string
  readonly variant_title: string
  readonly quantity: number
  readonly image_url: string
}

export type CartLinesProps = {
  readonly lines: PathRef<readonly CartLine[]>
  /** What the cart still holds beyond the lines Shopify put in the message. */
  readonly remaining: PathRef<number>
}

export const CartLines = ({ lines, remaining }: CartLinesProps) => (
  <Section style={{ paddingTop: 18 }}>
    <For each={lines}>
      {(line) => (
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
              <If test={isTruthy(line.image_url)}>
                <Img
                  alt=""
                  height={48}
                  src={liquidValue(line.image_url)}
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
              <Var path={line.title} />
            </div>
            <If test={isPresent(line.variant_title)}>
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
                <Var path={line.variant_title} />
              </div>
            </If>
          </Column>
          <Column align="right" style={{ padding: "12px 0 12px 10px", textAlign: "right", verticalAlign: "top" }}>
            <div
              className="dk-muted"
              style={{ color: color.inkSoft, fontFamily: font.body, fontSize: 12, fontWeight: 400, lineHeight: "17px" }}
            >
              Qty <Var path={line.quantity} />
            </div>
          </Column>
        </Row>
      )}
    </For>
    <If test={gt(remaining, 0)}>
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 12.5,
          fontWeight: 400,
          lineHeight: "19px",
          paddingTop: 14
        }}
      >
        Plus <Var path={remaining} /> more in your cart.
      </div>
    </If>
  </Section>
)
