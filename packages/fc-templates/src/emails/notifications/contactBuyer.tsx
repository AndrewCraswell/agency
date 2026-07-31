import { definePreview, defineTemplate, Var } from "@repo/shopify-emails"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

export const contactBuyer = defineTemplate({
  type: "contact_buyer",
  subject: () => "A note from the Fencing Club team",
  render: (vars) => (
    <EmailDocument preview="A note from the Fencing Club team." title="A note from our team">
      <EmailHeader eyebrow="A MESSAGE FOR YOU" />
      <EmailTitle>A note from our team</EmailTitle>
      <EmailLead>
        Hi <Var path={vars.customer.first_name} />, <Var path={vars.custom_message} />
      </EmailLead>
      <SupportBand>
        Have a question about your order? Just reply to this email and a real person on our team will get back to you.
      </SupportBand>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(contactBuyer)
