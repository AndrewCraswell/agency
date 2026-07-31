import { Capture, Else, eq, gt, If, markupBinding, type PathRef } from "@repo/shopify-emails"

/*
 * How much of the order a shipment covers changes the headline five ways, and the sentence under
 * it is the same phrase with a follow-up added. Captured once and read twice, because writing the
 * branch out per template is how three near-identical notifications drift apart.
 */

export const fulfillmentTitle = markupBinding("email_title")
export const fulfillmentBody = markupBinding("email_body")

export type FulfillmentWording = {
  /** Every item in the order is in this shipment. */
  readonly whole: string
  readonly lastOfSeveral: string
  readonly someOfSeveral: string
  readonly lastSingle: string
  readonly oneSingle: string
}

export type FulfillmentCopyProps = {
  readonly shipmentItems: PathRef<number>
  readonly orderItems: PathRef<number>
  readonly fulfillmentStatus: PathRef<string>
  readonly wording: FulfillmentWording
  /** The sentence that follows whichever phrase the branches pick. */
  readonly trailer: string
}

const branch = (
  { fulfillmentStatus, orderItems, shipmentItems, wording }: FulfillmentCopyProps,
  say: (phrase: string) => string
) => (
  <If test={eq(shipmentItems, orderItems)}>
    {say(wording.whole)}
    <Else>
      <If test={gt(shipmentItems, 1)}>
        <If test={eq(fulfillmentStatus, "fulfilled")}>
          {say(wording.lastOfSeveral)}
          <Else>{say(wording.someOfSeveral)}</Else>
        </If>
        <Else>
          <If test={eq(fulfillmentStatus, "fulfilled")}>
            {say(wording.lastSingle)}
            <Else>{say(wording.oneSingle)}</Else>
          </If>
        </Else>
      </If>
    </Else>
  </If>
)

export const FulfillmentCopy = (props: FulfillmentCopyProps) => (
  <>
    <Capture to={fulfillmentTitle}>{branch(props, (phrase) => phrase)}</Capture>
    <Capture to={fulfillmentBody}>{branch(props, (phrase) => `${phrase}. ${props.trailer}`)}</Capture>
  </>
)
