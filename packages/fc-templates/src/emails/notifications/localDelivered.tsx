import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Link } from "react-email"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { color, shopLinks } from "../components/tokens.ts"

/* No item list: our courier delivers the whole order at once, so naming the contents adds nothing. */
export const localDelivered = defineTemplate({
  type: "local_delivered",
  subject: (vars) => `Order ${liquidValue(vars.order_name)} has been delivered`,
  render: (vars) => (
    <EmailDocument
      preview={`Order ${liquidValue(vars.order_name)} has been delivered by our local courier.`}
      title="Your order has been delivered"
    >
      <EmailHeader eyebrow="DELIVERED" />
      <EmailTitle>Your order has been delivered</EmailTitle>
      <EmailLead>
        Haven’t received your order?{" "}
        <Link href={shopLinks.contact} style={{ color: color.ink, textDecoration: "underline" }}>
          Let us know
        </Link>
        .
      </EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url, ["default: shop.url"])}>View your order</EmailButton>
      <SupportBand heading="Something not right?">
        If anything arrived damaged or wasn’t what you expected, our team will make it right. Just reply to this email.
      </SupportBand>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(localDelivered)
