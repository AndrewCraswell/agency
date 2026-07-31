import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { QuickLinks } from "../components/QuickLinks.tsx"

export const customerAccountWelcome = defineTemplate({
  type: "customer_account_welcome",
  subject: () => "Welcome to Fencing Club",
  render: (vars) => (
    <EmailDocument preview="Your account is ready. Here’s where to start." title="Welcome to Fencing Club">
      <EmailHeader eyebrow="WELCOME" />
      <EmailTitle>Welcome to Fencing Club</EmailTitle>
      <EmailLead>
        Your account is ready. Explore championship-grade blades, jackets, and club kit, all in one place, built for
        fencers who take the piste seriously.
      </EmailLead>
      <EmailButton href={liquidValue(vars.shop.url)}>Visit our store</EmailButton>
      <QuickLinks />
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(customerAccountWelcome)
