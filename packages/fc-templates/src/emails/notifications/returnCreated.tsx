import { definePreview, defineTemplate, Else, eq, For, gt, If, isPresent, liquidValue, Var } from "@repo/shopify-emails"
import { Link } from "react-email"
import { Band } from "../components/Band.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { EmailFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { EmailLead, EmailTitle } from "../components/EmailIntro.tsx"
import { ItemList, ItemRow } from "../components/ItemRow.tsx"
import { ReturnTotals } from "../components/ReturnTotals.tsx"
import { InstructionList } from "../components/StepList.tsx"

/*
 * Whether we could print the label ourselves changes what the customer has to do, so the whole top
 * half of the message turns on the delivery type. A return that carries several deliveries still
 * describes one journey, so the first one speaks for all of them.
 */

export const returnCreated = defineTemplate({
  type: "return_created",
  subject: (vars) => `Complete your return for order ${liquidValue(vars.order_name)}`,
  render: (vars) => {
    const delivery = vars.return.deliveries.first
    return (
      <EmailDocument preview="Here’s how to get your return items back to us." title="Complete your return">
        <EmailHeader eyebrow="RETURN STARTED" />
        <If test={eq(delivery.type, "shopify_label")}>
          <EmailTitle>Your return shipping label is ready</EmailTitle>
          <EmailLead>
            Print your return shipping label and attach it to the package containing your return items.
          </EmailLead>
          <EmailButton href={liquidValue(delivery.return_label.public_file_url)}>Print return label</EmailButton>
          <Else>
            <EmailTitle>Complete your return</EmailTitle>
            <EmailLead>
              We’ve sent you a return shipping label, or you will receive one soon. Once you receive your return
              shipping label, get your returned items and follow the instructions to complete your return.
            </EmailLead>
          </Else>
        </If>
        <If test={isPresent(vars.return.checkout_payment_collection_url)}>
          <EmailButton href={liquidValue(vars.return.checkout_payment_collection_url)} spacing={12} variant="secondary">
            Pay now
          </EmailButton>
        </If>
        <Band kicker="INSTRUCTIONS" padding={36}>
          <If test={eq(delivery.type, "shopify_label")}>
            <InstructionList
              items={[
                { body: "Pack the items you’re returning.", id: "pack" },
                {
                  body: "Pay the outstanding balance.",
                  id: "pay",
                  when: isPresent(vars.return.checkout_payment_collection_url)
                },
                {
                  body: "Print your return shipping label and attach it to the package. Cover or remove any old shipping labels.",
                  id: "attach"
                },
                {
                  body: (
                    <If test={isPresent(delivery.carrier_name)}>
                      Give the package to <Var path={delivery.carrier_name} />.
                      <Else>Give the package to the carrier identified on the label.</Else>
                    </If>
                  ),
                  id: "hand-over"
                }
              ]}
            />
            <Else>
              <InstructionList
                items={[
                  {
                    body: "Print your return shipping label. If you haven’t received it yet, we’ll send it to you soon.",
                    id: "print"
                  },
                  { body: "Attach the label to the package. Cover or remove any old shipping labels.", id: "attach" },
                  {
                    body: (
                      <If test={isPresent(delivery.tracking_url)}>
                        Track your return using{" "}
                        <Link href={liquidValue(delivery.tracking_url)}>your tracking number</Link> to make sure we get
                        it.
                        <Else>Track your return using your tracking number to make sure we get it.</Else>
                      </If>
                    ),
                    id: "track"
                  }
                ]}
              />
            </Else>
          </If>
        </Band>
        <If test={gt(vars.return.line_items.size, 0)}>
          <ItemList label="ITEMS TO RETURN">
            <For each={vars.return.line_items}>
              {(line) => <ItemRow credit free line={line} variantTitle={line.variant_title} />}
            </For>
          </ItemList>
        </If>
        <If test={gt(vars.return.exchange_line_items.size, 0)}>
          <ItemList label="ITEMS YOU’LL RECEIVE">
            <For each={vars.return.exchange_line_items}>
              {(line) => <ItemRow free line={line} variantTitle={line.variant_title} />}
            </For>
          </ItemList>
        </If>
        <ReturnTotals returned={vars.return} />
        <EmailFooter shop={vars.shop} />
      </EmailDocument>
    )
  }
})

export default definePreview(returnCreated)
