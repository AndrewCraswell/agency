import {
  Capture,
  definePreview,
  defineTemplate,
  Else,
  If,
  isPresent,
  isTruthy,
  liquidValue,
  markupBinding,
  Var
} from "@repo/shopify-emails"
import { CodeCard } from "../components/CodeCard.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { GiftMessage } from "../components/GiftMessage.tsx"
import { StatPanel } from "../components/StatPanel.tsx"

/* Whoever paid is the sender, and they may have left only an email or a phone number behind. */
const senderName = markupBinding("sender_name")

export const giftCardNotification = defineTemplate({
  type: "gift_card_notification",
  subject: () => "Someone sent you a Fencing Club gift card",
  render: (vars) => (
    <EmailDocument
      preview="Someone sent you a Fencing Club gift card. Redeem the code below at checkout, online or in store."
      title="You have a gift card"
    >
      <Capture to={senderName}>
        <If test={isTruthy(vars.gift_card.customer)}>
          <If test={isPresent(vars.gift_card.customer.name)}>
            <Var path={vars.gift_card.customer.name} />
            <Else>
              <If test={isPresent(vars.gift_card.customer.email)}>
                <Var path={vars.gift_card.customer.email} />
                <Else>
                  <Var path={vars.gift_card.customer.phone} />
                </Else>
              </If>
            </Else>
          </If>
          <Else>
            <Var path={vars.shop.name} />
          </Else>
        </If>
      </Capture>
      <EmailHeader eyebrow="GIFT CARD" />
      <EmailTitle>
        <Var path={senderName} /> sent you a gift card
      </EmailTitle>
      <EmailLead>
        A gift card is waiting for your next season on the piste. Use the code below at checkout to redeem it.
      </EmailLead>
      <If test={isPresent(vars.gift_card.message)}>
        <GiftMessage from={<Var path={senderName} />}>
          <Var path={vars.gift_card.message} />
        </GiftMessage>
      </If>
      <StatPanel
        label="GIFT CARD BALANCE"
        note={
          <If test={isTruthy(vars.gift_card.expires_on)}>
            Expires <Var filters={["date: '%B %-d, %Y'"]} path={vars.gift_card.expires_on} />
          </If>
        }
      >
        <Var filters={["money"]} path={vars.gift_card.initial_value} />
      </StatPanel>
      <CodeCard code={<Var filters={["format_code"]} path={vars.gift_card.code} />} label="GIFT CARD CODE">
        Enter this code at checkout, online or in store.
      </CodeCard>
      <EmailButton href={liquidValue(vars.shop.url)}>Visit online store</EmailButton>
      <EmailButton href={liquidValue(vars.gift_card.url)} variant="secondary">
        Check your balance
      </EmailButton>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(giftCardNotification)
