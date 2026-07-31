import { definePreview, defineTemplate, Var } from "@repo/shopify-emails"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"

/* No action to offer: the change already happened, so the card reports it rather than asking. */
export const customerEmailAddressChangedConfirmation = defineTemplate({
  type: "customer_email_address_changed_confirmation",
  subject: () => "Your Fencing Club email address was changed",
  render: (vars) => (
    <EmailDocument preview="The email address on your account was just updated." title="Your email address was changed">
      <EmailHeader eyebrow="EMAIL UPDATED" />
      <EmailTitle>Your email address was changed</EmailTitle>
      <EmailLead>
        The email address on your Fencing Club account was just updated. If this wasn’t you, contact us right away so we
        can secure your account.
      </EmailLead>
      <HelpCard headline="Your email address" kicker="WHAT CHANGED">
        Previous: <Var path={vars.previous_email} />
        <br />
        New: <Var path={vars.new_email} />
        <br />
        <br />
        Didn’t make this change? Contact us right away to secure your account.
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(customerEmailAddressChangedConfirmation)
