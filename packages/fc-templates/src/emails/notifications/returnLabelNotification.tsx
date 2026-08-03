import { definePreview, defineTemplate, If, isPresent, liquidValue } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { InstructionList } from "../components/StepList.tsx"

export const returnLabelNotification = defineTemplate({
  type: "return_label_notification",
  subject: (vars) => `Your return label for order ${liquidValue(vars.order_name)} is ready`,
  render: (vars) => (
    <EmailDocument
      preview="Print it, attach it, and hand the package to the carrier."
      title="Your return label is ready"
    >
      <EmailHeader eyebrow="RETURN LABEL" />
      <EmailTitle>Your return label is ready</EmailTitle>
      <EmailLead>Print the label below and follow the three steps to send your return back to us.</EmailLead>
      <EmailButton href={liquidValue(vars.return_label.public_file_url)}>Print return label</EmailButton>
      <If test={isPresent(vars.shop.url)}>
        <EmailButton href={liquidValue(vars.shop.url)} spacing={12} variant="secondary">
          Visit our store
        </EmailButton>
      </If>
      <Band kicker="INSTRUCTIONS" padding={36}>
        <InstructionList
          items={[
            { body: "Pack the items you’re returning.", id: "pack" },
            {
              body: "Print your return label and attach it to the package. Cover any existing shipping labels.",
              id: "attach"
            },
            { body: "Give the package to the carrier identified on the label.", id: "hand-over" }
          ]}
        />
      </Band>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(returnLabelNotification)
