import { definePreview, defineTemplate, Else, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"

export const customerAccountActivate = defineTemplate({
  type: "customer_account_activate",
  subject: () => "Activate your Fencing Club account",
  render: (vars) => (
    <EmailDocument preview="Activate your account to track orders and check out faster." title="Activate your account">
      <EmailHeader eyebrow="ACTIVATE ACCOUNT" />
      <EmailTitle>Activate your account</EmailTitle>
      <EmailLead>
        {/* A merchant can replace the standard line from the admin, so the default is the fallback. */}
        <If test={isPresent(vars.custom_message)}>
          <Var raw path={vars.custom_message} />
          <Else>
            You’re one step from a Fencing Club account. Activate it to track orders, save your kit list, and check out
            faster next time.
          </Else>
        </If>
      </EmailLead>
      <EmailButton href={liquidValue(vars.customer.account_activation_url)}>Activate your account</EmailButton>
      <HelpCard headline="Didn’t request this?" kicker="GOOD TO KNOW">
        If you didn’t create a Fencing Club account, you can safely ignore this email. Nothing will be set up until you
        activate it.
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(customerAccountActivate)
