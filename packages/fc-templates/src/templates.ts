import { compileSubject, compileTemplate, type TemplateDefinition } from "@repo/shopify-emails"
import { abandonedCartLastCall } from "./emails/marketing/abandonedCartLastCall.tsx"
import { abandonedCartReassurance } from "./emails/marketing/abandonedCartReassurance.tsx"
import { abandonedCartReminder } from "./emails/marketing/abandonedCartReminder.tsx"
import { backInStock } from "./emails/marketing/backInStock.tsx"
import { chooseYourWeapon } from "./emails/marketing/chooseYourWeapon.tsx"
import { coachDiscount } from "./emails/marketing/coachDiscount.tsx"
import { community } from "./emails/marketing/community.tsx"
import { journal } from "./emails/marketing/journal.tsx"
import { newArrivals } from "./emails/marketing/newArrivals.tsx"
import { novusLaunch } from "./emails/marketing/novusLaunch.tsx"
import { productLaunch } from "./emails/marketing/productLaunch.tsx"
import { reviewRequest } from "./emails/marketing/reviewRequest.tsx"
import { seasonKickoff } from "./emails/marketing/seasonKickoff.tsx"
import { tournamentPrep } from "./emails/marketing/tournamentPrep.tsx"
import { vacationDelay } from "./emails/marketing/vacationDelay.tsx"
import { welcome } from "./emails/marketing/welcome.tsx"
import { winBack } from "./emails/marketing/winBack.tsx"
import { buyOnline } from "./emails/notifications/buyOnline.tsx"
import { companyContactWelcomeEmail } from "./emails/notifications/companyContactWelcomeEmail.tsx"
import { companyLocationUpdatePaymentMethod } from "./emails/notifications/companyLocationUpdatePaymentMethod.tsx"
import { contactBuyer } from "./emails/notifications/contactBuyer.tsx"
import { customerAccountActivate } from "./emails/notifications/customerAccountActivate.tsx"
import { customerAccountReset } from "./emails/notifications/customerAccountReset.tsx"
import { customerAccountWelcome } from "./emails/notifications/customerAccountWelcome.tsx"
import { customerAddPaymentMethod } from "./emails/notifications/customerAddPaymentMethod.tsx"
import { customerEmailAddressChangedConfirmation } from "./emails/notifications/customerEmailAddressChangedConfirmation.tsx"
import { customerMarketingConfirmation } from "./emails/notifications/customerMarketingConfirmation.tsx"
import { customerRestorePaymentMethod } from "./emails/notifications/customerRestorePaymentMethod.tsx"
import { customerUpdatePaymentMethod } from "./emails/notifications/customerUpdatePaymentMethod.tsx"
import { draftOrderInvoice } from "./emails/notifications/draftOrderInvoice.tsx"
import { failedPaymentProcessing } from "./emails/notifications/failedPaymentProcessing.tsx"
import { giftCardConfirmation } from "./emails/notifications/giftCardConfirmation.tsx"
import { giftCardNotification } from "./emails/notifications/giftCardNotification.tsx"
import { localDelivered } from "./emails/notifications/localDelivered.tsx"
import { localMissedDelivery } from "./emails/notifications/localMissedDelivery.tsx"
import { localOutForDelivery } from "./emails/notifications/localOutForDelivery.tsx"
import { orderConfirmation } from "./emails/notifications/orderConfirmation.tsx"
import { orderInvoice } from "./emails/notifications/orderInvoice.tsx"
import { orderLink } from "./emails/notifications/orderLink.tsx"
import { orderPaymentReceipt } from "./emails/notifications/orderPaymentReceipt.tsx"
import { paymentReminder } from "./emails/notifications/paymentReminder.tsx"
import { pendingPaymentFailure } from "./emails/notifications/pendingPaymentFailure.tsx"
import { pendingPaymentSuccess } from "./emails/notifications/pendingPaymentSuccess.tsx"
import { pickupReceipt } from "./emails/notifications/pickupReceipt.tsx"
import { posExchangeV2Receipt } from "./emails/notifications/posExchangeV2Receipt.tsx"
import { posSendCart } from "./emails/notifications/posSendCart.tsx"
import { readyForPickup } from "./emails/notifications/readyForPickup.tsx"
import { shipmentDelivered } from "./emails/notifications/shipmentDelivered.tsx"
import { shipmentOutForDelivery } from "./emails/notifications/shipmentOutForDelivery.tsx"
import { shippingConfirmation } from "./emails/notifications/shippingConfirmation.tsx"
import { shippingUpdate } from "./emails/notifications/shippingUpdate.tsx"
import { storeCreditIssued } from "./emails/notifications/storeCreditIssued.tsx"
import { storeReceipt } from "./emails/notifications/storeReceipt.tsx"
import { renderDefinition, renderDefinitionValues } from "./reactEmail.ts"

/*
 * The roster every whole-library check runs over. Each template is narrowed to the operations a
 * check needs, because a list of differently-typed variables is a union that no single generic call
 * will accept, and because the alternative is repeating the roster in each test file.
 */

export type TemplateEntry = {
  readonly id: string
  /** The Liquid that gets pasted into Shopify. */
  readonly compile: () => Promise<string>
  readonly subject: () => string
  /** Compiled to Liquid, then run against the sample data. */
  readonly render: () => Promise<string>
  /** The subject line after Liquid has run, which ships in its own box in the admin. */
  readonly renderSubject: () => Promise<string>
  /** Resolved straight from the tree, which is what the preview shows. */
  readonly renderValues: () => string
}

const entry = <TVariables extends object>(template: TemplateDefinition<TVariables>): TemplateEntry => ({
  id: template.id,
  compile: () => compileTemplate(template, { pretty: true }),
  subject: () => compileSubject(template),
  render: async () => (await renderDefinition(template)).html,
  renderSubject: async () => (await renderDefinition(template)).subject,
  renderValues: () => renderDefinitionValues(template)
})

export const allTemplates: readonly TemplateEntry[] = [
  entry(abandonedCartLastCall),
  entry(abandonedCartReassurance),
  entry(abandonedCartReminder),
  entry(backInStock),
  entry(buyOnline),
  entry(chooseYourWeapon),
  entry(coachDiscount),
  entry(community),
  entry(companyContactWelcomeEmail),
  entry(companyLocationUpdatePaymentMethod),
  entry(contactBuyer),
  entry(customerAccountActivate),
  entry(customerAccountReset),
  entry(customerAccountWelcome),
  entry(customerAddPaymentMethod),
  entry(customerEmailAddressChangedConfirmation),
  entry(customerMarketingConfirmation),
  entry(customerRestorePaymentMethod),
  entry(customerUpdatePaymentMethod),
  entry(draftOrderInvoice),
  entry(failedPaymentProcessing),
  entry(giftCardConfirmation),
  entry(giftCardNotification),
  entry(journal),
  entry(localDelivered),
  entry(localMissedDelivery),
  entry(localOutForDelivery),
  entry(newArrivals),
  entry(novusLaunch),
  entry(orderConfirmation),
  entry(orderInvoice),
  entry(orderLink),
  entry(orderPaymentReceipt),
  entry(paymentReminder),
  entry(pendingPaymentFailure),
  entry(pendingPaymentSuccess),
  entry(pickupReceipt),
  entry(posExchangeV2Receipt),
  entry(posSendCart),
  entry(productLaunch),
  entry(readyForPickup),
  entry(reviewRequest),
  entry(seasonKickoff),
  entry(shipmentDelivered),
  entry(shipmentOutForDelivery),
  entry(shippingConfirmation),
  entry(shippingUpdate),
  entry(storeCreditIssued),
  entry(storeReceipt),
  entry(tournamentPrep),
  entry(vacationDelay),
  entry(welcome),
  entry(winBack)
]
