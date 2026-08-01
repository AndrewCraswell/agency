import { binding, Else, If, isTruthy, liquidValue, Var } from "@repo/shopify-emails"
import { Column, Img, Row, Section } from "react-email"
import { brand, color, font, gutter, logoUrl } from "./tokens.ts"

/* Every message names the same store, so the header reads the global drop rather than taking it. */
const shopName = binding<string>("shop.name")

export type EmailHeaderProps = {
  /** The small caps line under the wordmark that says which message this is. */
  readonly eyebrow: string
}

export const EmailHeader = ({ eyebrow }: EmailHeaderProps) => (
  <Section
    className="px dk-band"
    style={{ backgroundColor: color.surfaceDark, padding: `24px ${gutter}px`, textAlign: "center" }}
  >
    <Row style={{ margin: "0 auto", width: "auto" }}>
      <Column style={{ paddingRight: 12, verticalAlign: "middle" }}>
        <If test={isTruthy(brand.logoUrl)}>
          {/* The merchant's own upload sizes itself, so only the width they chose is set. */}
          <Img
            alt={liquidValue(shopName)}
            src={liquidValue(brand.logoUrl)}
            style={{ border: 0, display: "block" }}
            width={liquidValue(brand.logoWidth)}
          />
          <Else>
            {/* The asset is 104x126, a 2x export, so this is its natural size. */}
            <Img
              alt={liquidValue(shopName)}
              height={63}
              src={logoUrl}
              style={{ border: 0, display: "block" }}
              width={52}
            />
          </Else>
        </If>
      </Column>
      <Column style={{ textAlign: "left", verticalAlign: "middle" }}>
        <div
          style={{
            color: color.onDark,
            fontFamily: font.display,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 3,
            lineHeight: "22px"
          }}
        >
          <Var filters={["upcase"]} path={shopName} />
        </div>
        <div
          style={{
            color: color.onDarkSoft,
            fontFamily: font.body,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 1.5,
            lineHeight: "14px",
            paddingTop: 2
          }}
        >
          {eyebrow}
        </div>
      </Column>
    </Row>
  </Section>
)
