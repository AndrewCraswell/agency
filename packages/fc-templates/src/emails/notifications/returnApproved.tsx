import {
  and,
  Assign,
  binding,
  definePreview,
  defineTemplate,
  Else,
  eq,
  For,
  gt,
  If,
  isPresent,
  liquidValue,
  or,
  pathOf,
  Var
} from "@repo/shopify-emails"
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
 * The approval, which has to say how far along the return actually is: we may have a label, we may
 * only have a promise of one, and there may be a balance to settle before either matters.
 */

const labelSize = binding<number>("return_label_size")
const deliveryCount = binding<number>("return_delivery_count")

export const returnApproved = defineTemplate({
  type: "return_approved",
  subject: (vars) => `Your return for order ${liquidValue(vars.order_name)} was approved`,
  render: (vars) => {
    const delivery = vars.return.deliveries.first
    const balanceDue = gt(vars.return.order_total_outstanding, 0)
    return (
      <EmailDocument preview="Your return was approved. Here’s what happens next." title="Your return was approved">
        <EmailHeader eyebrow="RETURN APPROVED" />
        {/* Shopify writes an empty string rather than nil for a missing label, so length is the test. */}
        <Assign to={labelSize} value={`${pathOf(delivery.return_label.public_file_url)} | size`} />
        <Assign to={deliveryCount} value={`${pathOf(vars.return.deliveries)} | size`} />
        <EmailTitle>Your return was approved</EmailTitle>
        <EmailLead>
          <If test={gt(deliveryCount, 0)}>
            <If test={gt(labelSize, 0)}>
              Print your return shipping label and attach it to the package containing your return items.
              <Else>
                <If test={and(eq(delivery.type, "shopify_label"), balanceDue)}>
                  Your return was approved and a balance is due. Pay the outstanding balance, and once you receive your
                  return shipping label, follow the instructions to complete your return.
                  <Else>
                    We sent you a return shipping label, or you will receive one soon. Once you receive your return
                    shipping label, follow the instructions to complete your return.
                  </Else>
                </If>
              </Else>
            </If>
            <Else>We will send you additional information to complete the return.</Else>
          </If>
        </EmailLead>
        <If test={gt(labelSize, 0)}>
          <EmailButton href={liquidValue(delivery.return_label.public_file_url)}>Print return label</EmailButton>
        </If>
        <If test={isPresent(vars.return.checkout_payment_collection_url)}>
          <EmailButton href={liquidValue(vars.return.checkout_payment_collection_url)} spacing={12} variant="secondary">
            Pay now
          </EmailButton>
        </If>
        <If test={and(gt(deliveryCount, 0), or(gt(labelSize, 0), isPresent(delivery.tracking_number)))}>
          <Band kicker="INSTRUCTIONS" padding={36}>
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
                  id: "attach",
                  when: gt(labelSize, 0)
                },
                {
                  body: (
                    <If test={isPresent(delivery.carrier_name)}>
                      Give the package to <Var path={delivery.carrier_name} />.
                      <Else>Give the package to the carrier identified on the label.</Else>
                    </If>
                  ),
                  id: "hand-over"
                },
                {
                  body: (
                    <>
                      Track your return to make sure we get it.{" "}
                      <If test={isPresent(delivery.carrier_name)}>
                        <Var path={delivery.carrier_name} /> tracking number:
                        <Else>Tracking number:</Else>
                      </If>{" "}
                      <Var path={delivery.tracking_number} />
                    </>
                  ),
                  id: "track",
                  when: isPresent(delivery.tracking_number)
                }
              ]}
            />
          </Band>
        </If>
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

export default definePreview(returnApproved)
