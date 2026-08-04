import { definePreview, defineTemplate, Else, If, isPresent, Var } from "@repo/shopify-emails"
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
        {/* The merchant writes the whole paragraph, greeting included, so it replaces rather than follows ours. */}
        <If test={isPresent(vars.custom_message)}>
          <Var raw path={vars.custom_message} />
          <Else>
            Hi <Var filters={["default: 'there'"]} path={vars.customer.first_name} />, we wanted to check in about your
            recent order.
          </Else>
        </If>
      </EmailLead>
      <SupportBand>
        Have a question about your order? Just reply to this email and a real person on our team will get back to you.
      </SupportBand>
      <EmailFooter flush shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(contactBuyer)
