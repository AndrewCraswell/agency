import { definePreview, defineTemplate, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"
import { shopLinks } from "../components/tokens.ts"

/* The action is a conversation, not a page, so the button goes to support rather than the order. */
export const localMissedDelivery = defineTemplate({
  type: "local_missed_delivery",
  subject: (vars) => `We missed you with order ${liquidValue(vars.order_name)}`,
  render: (vars) => (
    <EmailDocument
      preview={`We tried to deliver order ${liquidValue(vars.order_name)} but no one was available to receive it.`}
      title="Sorry we missed you"
    >
      <EmailHeader eyebrow="DELIVERY MISSED" />
      <EmailTitle>Sorry we missed you</EmailTitle>
      <EmailLead>
        Hi <Var path={vars.customer.first_name} />, we weren’t able to deliver your order.
      </EmailLead>
      <EmailButton href={shopLinks.contact}>Contact us to reschedule</EmailButton>
      <HelpCard headline="Arrange another delivery" kicker="NEXT STEPS">
        Reply to this email or contact our team and we’ll schedule a new delivery time that works for you.
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(localMissedDelivery)
