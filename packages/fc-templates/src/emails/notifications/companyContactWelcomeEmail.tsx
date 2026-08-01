import { definePreview, defineTemplate, liquidValue, Var } from "@repo/shopify-emails"
import { Link } from "react-email"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { QuickLinks } from "../components/QuickLinks.tsx"
import { color } from "../components/tokens.ts"

export const companyContactWelcomeEmail = defineTemplate({
  type: "company_contact_welcome_email",
  subject: () => "Your Fencing Club ordering access is ready",
  render: (vars) => (
    <EmailDocument
      preview="Sign in to place orders and see your negotiated pricing."
      title="Your ordering access is ready"
    >
      <EmailHeader eyebrow="B2B ACCESS" />
      <EmailTitle>Your ordering access is ready</EmailTitle>
      <EmailLead>
        Your organization now has ordering access at{" "}
        <Link href={liquidValue(vars.shop_link)} style={{ color: color.ink, textDecoration: "underline" }}>
          <Var path={vars.shop.name} />
        </Link>
        . Sign in to place orders, manage your roster, and view negotiated pricing.
      </EmailLead>
      <EmailButton href={liquidValue(vars.account_link)}>Go to account</EmailButton>
      <QuickLinks />
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(companyContactWelcomeEmail)
