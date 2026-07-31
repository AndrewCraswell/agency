import { definePreview, defineTemplate, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

export const orderLink = defineTemplate({
  type: "order_link",
  subject: (vars) => `View your order ${liquidValue(vars.order_name)}`,
  render: (vars) => (
    <EmailDocument preview={`Secure access to order ${liquidValue(vars.order_name)}.`} title="View your order">
      <EmailHeader eyebrow="YOUR ORDER" />
      <EmailTitle>View your order</EmailTitle>
      <EmailLead>
        Here’s secure access to order <Var path={vars.order_name} />. Review your items, check delivery status, and
        download your invoice anytime from your Fencing Club account.
      </EmailLead>
      <EmailButton href={liquidValue(vars.order_status_url)}>View your order</EmailButton>
      <SupportBand>
        Questions about order <Var path={vars.order_name} />? Reply anytime and our team will jump right in.
      </SupportBand>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(orderLink)
