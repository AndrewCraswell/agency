import { type Fulfillment, gt, If, isTruthy, liquidValue, type PathRef, Var } from "@repo/shopify-emails"
import { Button, Column, Row, Section } from "react-email"
import { accentFill, color, font, gutter, radius, sectionGap } from "./tokens.ts"

/*
 * The carrier and consignment number for a shipment, with a link straight to the carrier's page.
 *
 * The number is set in the mono face because it is meant to be read a character at a time and
 * copied, and it breaks mid-word so a long one cannot push the card wider than the email.
 */

export type TrackingProps = {
  readonly fulfillment: PathRef<Fulfillment>
}

export const Tracking = ({ fulfillment }: TrackingProps) => (
  <If test={gt(fulfillment.tracking_numbers.size, 0)}>
    <Section className="px" style={{ padding: `${sectionGap}px ${gutter}px 0` }}>
      <Section
        className="dk-surface dk-border"
        style={{
          backgroundColor: color.surface,
          border: `1px solid ${color.line}`,
          borderRadius: radius,
          padding: "18px 20px"
        }}
      >
        <div
          className="dk-muted"
          style={{
            color: color.inkSoft,
            fontFamily: font.body,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "1.4px",
            lineHeight: "14px",
            paddingBottom: 12
          }}
        >
          TRACKING
        </div>
        <Row>
          <Column style={{ verticalAlign: "middle" }}>
            <If test={isTruthy(fulfillment.tracking_company)}>
              <div
                className="dk-text"
                style={{ color: color.ink, fontFamily: font.body, fontSize: 13, fontWeight: 700, lineHeight: "18px" }}
              >
                <Var path={fulfillment.tracking_company} />
              </div>
            </If>
            <div
              className="dk-text appleLinks"
              style={{
                color: color.ink,
                fontFamily: font.mono,
                fontSize: 13,
                fontWeight: 400,
                lineHeight: "18px",
                paddingTop: 3,
                wordBreak: "break-all"
              }}
            >
              {/* `join` covers one number and several alike, which the stock template spells as two branches. */}
              <Var filters={["join: ', '"]} path={fulfillment.tracking_numbers} />
            </div>
          </Column>
          <If test={isTruthy(fulfillment.tracking_url)}>
            <Column align="right" style={{ verticalAlign: "middle", width: 152 }}>
              <Button
                className="dk-btn"
                href={liquidValue(fulfillment.tracking_url)}
                style={{
                  backgroundColor: accentFill(),
                  borderRadius: radius,
                  color: color.accentInk,
                  display: "inline-block",
                  fontFamily: font.body,
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: "16px",
                  padding: "10px 18px",
                  textDecoration: "none",
                  whiteSpace: "nowrap"
                }}
              >
                Track shipment
              </Button>
            </Column>
          </If>
        </Row>
      </Section>
    </Section>
  </If>
)
