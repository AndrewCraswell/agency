import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"

export const customerAccountReset = defineTemplate({
  type: "customer_account_reset",
  subject: () => "Reset your Fencing Club password",
  render: (vars) => (
    <EmailDocument preview="Choose a new password. The link is good for 24 hours." title="Reset your password">
      <EmailHeader eyebrow="RESET PASSWORD" />
      <EmailTitle>Reset your password</EmailTitle>
      <EmailLead>
        We received a request to reset the password for your Fencing Club account. Choose a new one below. The link
        stays active for the next 24 hours.
      </EmailLead>
      <EmailButton href={liquidValue(vars.customer.reset_password_url)}>Reset your password</EmailButton>
      <HelpCard headline="Didn’t request this?" kicker="GOOD TO KNOW">
        If you didn’t ask to reset your password, you can safely ignore this email. Your current password will stay the
        same.
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(customerAccountReset)
