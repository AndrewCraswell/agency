import { definePreview, defineTemplate, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { HelpCard } from "../components/HelpCard.tsx"
import { StatPanel } from "../components/StatPanel.tsx"

export const storeCreditIssued = defineTemplate({
  type: "store_credit_issued",
  subject: () => "You’ve received Fencing Club store credit",
  render: (vars) => (
    <EmailDocument preview="Your store credit is ready to spend." title="You’ve received store credit">
      <EmailHeader eyebrow="STORE CREDIT" />
      <EmailTitle>You’ve received store credit</EmailTitle>
      <EmailLead>
        Hi <Var path={vars.customer.first_name} />, we’ve added store credit to your account. It will be applied
        automatically the next time you check out.
      </EmailLead>
      <StatPanel label="CREDIT ADDED">
        <Var filters={["money"]} path={vars.issued_store_credit.amount} />
      </StatPanel>
      <EmailButton href={liquidValue(vars.routes.account_profile_url)}>View account</EmailButton>
      <HelpCard headline="Your balance" kicker="GOOD TO KNOW">
        You now have <Var filters={["money"]} path={vars.issued_store_credit.balance_after_transaction} /> in store
        credit.
        {/* Credit issued as a refund does not expire, so most of these carry no date. */}
        <If test={isPresent(vars.issued_store_credit.expires_at)}>
          {" "}
          It expires on <Var filters={["date: '%B %e, %Y'"]} path={vars.issued_store_credit.expires_at} />.
        </If>
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(storeCreditIssued)
