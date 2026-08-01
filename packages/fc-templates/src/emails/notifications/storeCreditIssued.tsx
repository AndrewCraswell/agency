import { definePreview, defineTemplate, Else, If, isPresent, isTruthy, liquidValue, Var } from "@repo/shopify-emails"
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
        Hi <Var filters={["default: 'there'"]} path={vars.customer.first_name} />, we’ve added store credit to your
        account. It comes off your total the next time you check out.
      </EmailLead>
      <StatPanel label="CREDIT ADDED">
        <Var filters={["money"]} path={vars.issued_store_credit.amount} />
      </StatPanel>
      <EmailButton href={liquidValue(vars.routes.account_profile_url)}>View account</EmailButton>
      <HelpCard headline="Your balance" kicker="GOOD TO KNOW">
        {/* A business buyer's credit sits with their location, so name it rather than say “your account”. */}
        <If test={isTruthy(vars.company_location)}>
          This has been automatically added to <Var path={vars.company_location.company.name} /> —{" "}
          <Var path={vars.company_location.name} />
          ’s account. The store credit balance is now{" "}
          <Var filters={["money_with_currency"]} path={vars.issued_store_credit.balance_after_transaction} />.
          <Else>
            This has been automatically added to your account. Your store credit balance is now{" "}
            <Var filters={["money_with_currency"]} path={vars.issued_store_credit.balance_after_transaction} />.
          </Else>
        </If>
        {/* Credit issued as a refund does not expire, so most of these carry no date. */}
        <If test={isPresent(vars.issued_store_credit.expires_at)}>
          {" "}
          It expires on <Var filters={["date: '%B %-d, %Y'"]} path={vars.issued_store_credit.expires_at} />.
        </If>
      </HelpCard>
      <EmailFooter shop={vars.shop} />
    </EmailDocument>
  )
})

export default definePreview(storeCreditIssued)
