import { liquidValue, type PathRef, Var } from "@repo/shopify-emails"
import { Img } from "react-email"

export type PaymentBrandProps = {
  readonly company: PathRef<string | null>
  readonly lastFour: PathRef<string | null>
}

/*
 * The card brand as the icon Shopify serves for it, which it keeps at notifications/<brand>.png.
 * The brand name stays as the alt text, so a client that blocks images still reads the line.
 */
export const PaymentBrand = ({ company, lastFour }: PaymentBrandProps) => (
  <>
    <Img
      alt={liquidValue(company)}
      height={16}
      src={liquidValue(company, [
        "downcase",
        "replace: ' ', '_'",
        "prepend: 'notifications/'",
        "append: '.png'",
        "shopify_asset_url"
      ])}
      style={{ display: "inline-block", marginRight: 6, verticalAlign: "middle" }}
      width={25}
    />
    ending <Var path={lastFour} />
  </>
)
