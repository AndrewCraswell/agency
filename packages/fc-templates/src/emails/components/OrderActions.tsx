import { Else, eq, If, isPresent, liquidExpression, liquidValue, type PathRef } from "@repo/shopify-emails"
import type { ReactNode } from "react"
import { Img } from "react-email"
import { ButtonPairCell, EmailButton, EmailButtonPair, PairedButton } from "./EmailButton.tsx"

/*
 * Shopify only fills these two drops for a shop the customer can track in the Shop app, so the
 * second action is conditional and the first has to stand alone without it. The variant key is the
 * only thing that says whether they already have the app; Shopify words those two cases apart.
 */

export type OrderActionsProps = {
  readonly href: string
  readonly children: ReactNode
  readonly shopUrl: PathRef<string | null>
  readonly shopVariantKey: PathRef<string | null>
}

/* Shopify serves the wordmark, sized to sit on its own brand purple the way its notifications do. */
const ShopWordmark = () => (
  <Img
    alt="Shop"
    height={17}
    src={liquidExpression("'mailer/shop_logo.png' | cdn_asset_url")}
    style={{ display: "inline-block", marginLeft: 6, verticalAlign: "middle" }}
    width={42}
  />
)

export const OrderActions = ({ children, href, shopUrl, shopVariantKey }: OrderActionsProps) => (
  <If test={isPresent(shopUrl)}>
    <EmailButtonPair>
      <ButtonPairCell side="left">
        <PairedButton href={href}>{children}</PairedButton>
      </ButtonPairCell>
      <ButtonPairCell side="right">
        <PairedButton href={liquidValue(shopUrl)} variant="shop">
          <If test={eq(shopVariantKey, "track_with_shop")}>
            Track order with
            <Else>Download to track with</Else>
          </If>
          <ShopWordmark />
        </PairedButton>
      </ButtonPairCell>
    </EmailButtonPair>
    <Else>
      <EmailButton href={href}>{children}</EmailButton>
    </Else>
  </If>
)
