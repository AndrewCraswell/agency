import { definePreview, defineTemplate, If, isTruthy, liquidValue, Var } from "@repo/shopify-emails"
import { CodeCard } from "../components/CodeCard.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { StatPanel } from "../components/StatPanel.tsx"

/*
 * `recipient` is unset here: a confirmation goes to the buyer, and the branch that names a
 * recipient only fires on the notification the buyer sends onward.
 *
 * `format_code` is Shopify's own filter: it groups the code so a person can read it back aloud.
 */
export const giftCardConfirmation = defineTemplate({
  type: "gift_card_confirmation",
  subject: () => "Your Fencing Club gift card is ready",
  render: (vars) => (
    <EmailDocument
      preview="Your Fencing Club gift card is ready. Enter the code at checkout, online or in store, to redeem your balance."
      title="Your gift card is ready"
    >
      <EmailHeader eyebrow="GIFT CARD" />
      <EmailTitle>Your gift card is ready</EmailTitle>
      <EmailLead>
        Thanks for your purchase. Your Fencing Club gift card is loaded and ready to use at checkout, online or in
        store.
      </EmailLead>
      <StatPanel
        label="GIFT CARD BALANCE"
        note={
          <If test={isTruthy(vars.gift_card.expires_on)}>
            Expires <Var filters={["date: '%B %e, %Y'"]} path={vars.gift_card.expires_on} />
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

export default definePreview(giftCardConfirmation)
