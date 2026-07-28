import { variables as abandonedCart1 } from "./templates/emails/marketing/abandoned-cart-1/standard.variables.ts"
import { variables as abandonedCart2 } from "./templates/emails/marketing/abandoned-cart-2/standard.variables.ts"
import { variables as abandonedCart3 } from "./templates/emails/marketing/abandoned-cart-3/standard.variables.ts"
import { variables as coachDiscountWelcome } from "./templates/emails/marketing/coach-discount-welcome/standard.variables.ts"
import { variables as welcome } from "./templates/emails/marketing/welcome/standard.variables.ts"
import { variables as buyOnline } from "./templates/emails/notifications/buy-online/standard.variables.ts"
import { variables as changeRequested } from "./templates/emails/notifications/change-requested/standard.variables.ts"
import { variables as companyContactWelcomeEmail } from "./templates/emails/notifications/company-contact-welcome-email/standard.variables.ts"
import { variables as companyLocationUpdatePaymentMethod } from "./templates/emails/notifications/company-location-update-payment-method/standard.variables.ts"
import { variables as contactBuyer } from "./templates/emails/notifications/contact-buyer/standard.variables.ts"
import { variables as customerAccountActivate } from "./templates/emails/notifications/customer-account-activate/standard.variables.ts"
import { variables as customerAccountReset } from "./templates/emails/notifications/customer-account-reset/standard.variables.ts"
import { variables as customerAccountWelcome } from "./templates/emails/notifications/customer-account-welcome/standard.variables.ts"
import { variables as customerAddPaymentMethod } from "./templates/emails/notifications/customer-add-payment-method/standard.variables.ts"
import { variables as customerEmailAddressChangedConfirmation } from "./templates/emails/notifications/customer-email-address-changed-confirmation/standard.variables.ts"
import { variables as customerMarketingConfirmation } from "./templates/emails/notifications/customer-marketing-confirmation/standard.variables.ts"
import { variables as customerRestorePaymentMethod } from "./templates/emails/notifications/customer-restore-payment-method/standard.variables.ts"
import { variables as customerUpdatePaymentMethod } from "./templates/emails/notifications/customer-update-payment-method/standard.variables.ts"
import { variables as draftOrderInvoice } from "./templates/emails/notifications/draft-order-invoice/standard.variables.ts"
import { variables as failedPaymentProcessing } from "./templates/emails/notifications/failed-payment-processing/standard.variables.ts"
import { variables as giftCardConfirmation } from "./templates/emails/notifications/gift-card-confirmation/standard.variables.ts"
import { variables as giftCardNotification } from "./templates/emails/notifications/gift-card-notification/standard.variables.ts"
import { variables as localDelivered } from "./templates/emails/notifications/local-delivered/standard.variables.ts"
import { variables as localMissedDelivery } from "./templates/emails/notifications/local-missed-delivery/standard.variables.ts"
import { variables as localOutForDelivery } from "./templates/emails/notifications/local-out-for-delivery/standard.variables.ts"
import { variables as orderCancelled } from "./templates/emails/notifications/order-cancelled/standard.variables.ts"
import { variables as orderConfirmation } from "./templates/emails/notifications/order-confirmation/standard.variables.ts"
import { variables as orderEdited } from "./templates/emails/notifications/order-edited/standard.variables.ts"
import { variables as orderInvoice } from "./templates/emails/notifications/order-invoice/standard.variables.ts"
import { variables as orderLink } from "./templates/emails/notifications/order-link/standard.variables.ts"
import { variables as orderPaymentReceipt } from "./templates/emails/notifications/order-payment-receipt/standard.variables.ts"
import { variables as paymentReminder } from "./templates/emails/notifications/payment-reminder/standard.variables.ts"
import { variables as pendingPaymentFailure } from "./templates/emails/notifications/pending-payment-failure/standard.variables.ts"
import { variables as pendingPaymentSuccess } from "./templates/emails/notifications/pending-payment-success/standard.variables.ts"
import { variables as pickupReceipt } from "./templates/emails/notifications/pickup-receipt/standard.variables.ts"
import { variables as posExchangeV2Receipt } from "./templates/emails/notifications/pos-exchange-v2-receipt/standard.variables.ts"
import { variables as posSendCart } from "./templates/emails/notifications/pos-send-cart/standard.variables.ts"
import { variables as readyForPickup } from "./templates/emails/notifications/ready-for-pickup/standard.variables.ts"
import { variables as refundNotification } from "./templates/emails/notifications/refund-notification/standard.variables.ts"
import { variables as requestedEditDeclined } from "./templates/emails/notifications/requested-edit-declined/standard.variables.ts"
import { variables as returnApproved } from "./templates/emails/notifications/return-approved/standard.variables.ts"
import { variables as returnCreated } from "./templates/emails/notifications/return-created/standard.variables.ts"
import { variables as returnDeclined } from "./templates/emails/notifications/return-declined/standard.variables.ts"
import { variables as returnLabelNotification } from "./templates/emails/notifications/return-label-notification/standard.variables.ts"
import { variables as returnRequested } from "./templates/emails/notifications/return-requested/standard.variables.ts"
import { variables as shipmentDelivered } from "./templates/emails/notifications/shipment-delivered/standard.variables.ts"
import { variables as shipmentOutForDelivery } from "./templates/emails/notifications/shipment-out-for-delivery/standard.variables.ts"
import { variables as shippingConfirmation } from "./templates/emails/notifications/shipping-confirmation/standard.variables.ts"
import { variables as shippingUpdate } from "./templates/emails/notifications/shipping-update/standard.variables.ts"
import { variables as storeCreditIssued } from "./templates/emails/notifications/store-credit-issued/standard.variables.ts"
import { variables as storeReceipt } from "./templates/emails/notifications/store-receipt/standard.variables.ts"
import { variables as invoiceMultipage } from "./templates/printouts/invoice/multipage.variables.ts"
import { variables as invoicePaid } from "./templates/printouts/invoice/paid.variables.ts"
import { variables as invoiceUnpaid } from "./templates/printouts/invoice/unpaid.variables.ts"
import { variables as packingSlipMultipage } from "./templates/printouts/packing-slip/multipage.variables.ts"
import { variables as packingSlipStandard } from "./templates/printouts/packing-slip/standard.variables.ts"
import type { Template, TemplateGroup } from "./types.ts"

/**
 * The Shopify store these templates belong to, as it appears in admin URLs. Shopify exposes no API
 * for notification or Order Printer templates, so this is a deep-link base, not a credential.
 */
export const STORE_HANDLE = "8f3f5f-3"

/** Where a human goes to paste a template in. */
export function adminUrl(template: Template): string {
  const section = template.type === "printout" ? "apps/order-printer" : "settings/notifications"
  return `https://admin.shopify.com/store/${STORE_HANDLE}/${section}`
}

/**
 * The folder each group lives in under `src/templates`. The tree splits by how a template reaches
 * a customer — printed, or emailed — because that is also what decides where it gets pasted in
 * Shopify: Order Printer for printouts, notification settings or the Email app for the rest.
 */
export const GROUP_SOURCE_DIRS: Record<TemplateGroup, string> = {
  Printouts: "printouts",
  "Marketing emails": "emails/marketing",
  "Customer notifications": "emails/notifications"
}

/*
 * Every template we author, in the order the preview index lists them. Ids for customer
 * notifications are Shopify's own; the rest are our folder slugs.
 */
export const templates: Template[] = [
  {
    type: "printout",
    group: "Printouts",
    id: "invoice",
    name: "Invoice",
    dir: "invoice",
    variations: [
      { id: "unpaid", name: "Balance due", variables: invoiceUnpaid },
      { id: "paid", name: "Paid in full", variables: invoicePaid },
      { id: "multipage", name: "Multi-page", variables: invoiceMultipage }
    ]
  },
  {
    type: "printout",
    group: "Printouts",
    id: "packing-slip",
    name: "Packing slip",
    dir: "packing-slip",
    variations: [
      { id: "standard", name: "Standard", variables: packingSlipStandard },
      { id: "multipage", name: "Multi-page", variables: packingSlipMultipage }
    ]
  },

  {
    type: "email",
    group: "Marketing emails",
    id: "welcome",
    name: "Welcome",
    dir: "welcome",
    subject: "Welcome to Fencing Club",
    variations: [{ id: "standard", name: "Standard", variables: welcome }]
  },
  {
    type: "email",
    group: "Marketing emails",
    id: "coach-discount-welcome",
    name: "Coach discount welcome",
    dir: "coach-discount-welcome",
    subject: "Welcome to the Fencing Club Coach Discount",
    variations: [{ id: "standard", name: "Standard", variables: coachDiscountWelcome }]
  },
  {
    type: "email",
    group: "Marketing emails",
    id: "abandoned-cart-1",
    name: "Abandoned cart 1",
    dir: "abandoned-cart-1",
    subject: "Items in your cart are selling out fast!",
    variations: [{ id: "standard", name: "Standard", variables: abandonedCart1 }]
  },
  {
    type: "email",
    group: "Marketing emails",
    id: "abandoned-cart-2",
    name: "Abandoned cart 2",
    dir: "abandoned-cart-2",
    subject: "Your cart misses you!",
    variations: [{ id: "standard", name: "Standard", variables: abandonedCart2 }]
  },
  {
    type: "email",
    group: "Marketing emails",
    id: "abandoned-cart-3",
    name: "Abandoned cart 3",
    dir: "abandoned-cart-3",
    subject: "Don’t miss out on 5% off your entire cart!",
    variations: [{ id: "standard", name: "Standard", variables: abandonedCart3 }]
  },

  {
    type: "email",
    group: "Customer notifications",
    id: "buy_online",
    name: "POS abandoned checkout",
    dir: "buy-online",
    subject: "Buy online from {{ shop_name }} when you're ready!",
    variations: [{ id: "standard", name: "Standard", variables: buyOnline }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "change_requested",
    name: "Request received",
    dir: "change-requested",
    subject:
      "{% if requested_edit and return %}Change requested for order {{ order.name }}{% elsif requested_edit %}Cancellation requested for order {{ order.name }}{% else %}Return requested for order {{ order.name }}{% endif %}",
    variations: [{ id: "standard", name: "Standard", variables: changeRequested }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "company_contact_welcome_email",
    name: "B2B access email",
    dir: "company-contact-welcome-email",
    subject: "Welcome to B2B ordering with {{shop.name}}",
    variations: [{ id: "standard", name: "Standard", variables: companyContactWelcomeEmail }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "company_location_update_payment_method",
    name: "B2B location update payment method",
    dir: "company-location-update-payment-method",
    subject: "Update your payment method for {{ shop.name }}'s {{ location_name }} location",
    variations: [{ id: "standard", name: "Standard", variables: companyLocationUpdatePaymentMethod }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "contact_buyer",
    name: "Contact customer",
    dir: "contact-buyer",
    subject: "Message from {{ shop.name }}",
    variations: [{ id: "standard", name: "Standard", variables: contactBuyer }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "customer_account_activate",
    name: "Customer account invite",
    dir: "customer-account-activate",
    subject: "Customer account activation",
    variations: [{ id: "standard", name: "Standard", variables: customerAccountActivate }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "customer_account_reset",
    name: "Customer account password reset",
    dir: "customer-account-reset",
    subject: "Customer account password reset",
    variations: [{ id: "standard", name: "Standard", variables: customerAccountReset }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "customer_account_welcome",
    name: "Customer account welcome",
    dir: "customer-account-welcome",
    subject: "Customer account confirmation",
    variations: [{ id: "standard", name: "Standard", variables: customerAccountWelcome }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "customer_add_payment_method",
    name: "Customer payment method add request",
    dir: "customer-add-payment-method",
    subject: "Add a payment method for {{ shop.name }}",
    variations: [{ id: "standard", name: "Standard", variables: customerAddPaymentMethod }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "customer_email_address_changed_confirmation",
    name: "Customer email address change confirmation",
    dir: "customer-email-address-changed-confirmation",
    subject: "Your email address has been changed",
    variations: [{ id: "standard", name: "Standard", variables: customerEmailAddressChangedConfirmation }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "customer_marketing_confirmation",
    name: "Customer marketing confirmation",
    dir: "customer-marketing-confirmation",
    subject: "Confirm you want to receive email marketing",
    variations: [{ id: "standard", name: "Standard", variables: customerMarketingConfirmation }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "customer_restore_payment_method",
    name: "Customer payment method restore request",
    dir: "customer-restore-payment-method",
    subject: "Verify your payment information for {{ shop.name }}",
    variations: [{ id: "standard", name: "Standard", variables: customerRestorePaymentMethod }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "customer_update_payment_method",
    name: "Customer payment method update request",
    dir: "customer-update-payment-method",
    subject: "Update your payment method for {{ shop.name }}",
    variations: [{ id: "standard", name: "Standard", variables: customerUpdatePaymentMethod }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "draft_order_invoice",
    name: "Draft order invoice",
    dir: "draft-order-invoice",
    subject: "Invoice {{name}}",
    variations: [{ id: "standard", name: "Standard", variables: draftOrderInvoice }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "failed_payment_processing",
    name: "Payment error",
    dir: "failed-payment-processing",
    subject: "[{{shop.name}}] Payment couldn’t be processed",
    variations: [{ id: "standard", name: "Standard", variables: failedPaymentProcessing }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "gift_card_confirmation",
    name: "Gift card receipt",
    dir: "gift-card-confirmation",
    subject:
      "{{ shop.name }} {{ gift_card.initial_value | money_without_trailing_zeros }} gift card{% if gift_card.recipient %} for {% if gift_card.recipient.nickname != blank %}{{ gift_card.recipient.nickname }}{% elsif gift_card.recipient.name != blank %}{{ gift_card.recipient.name }}{% else %}{{ gift_card.recipient.email }}{% endif %}{% endif %}",
    variations: [{ id: "standard", name: "Standard", variables: giftCardConfirmation }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "gift_card_notification",
    name: "New gift card",
    dir: "gift-card-notification",
    subject:
      "{{ shop.name }} {{ gift_card.initial_value | money_without_trailing_zeros }} gift card{% if gift_card.recipient and gift_card.customer %} from {% if gift_card.customer.name != blank %}{{ gift_card.customer.name }}{% elsif gift_card.customer.email != blank %}{{ gift_card.customer.email }}{% else %}{{ gift_card.customer.phone }}{% endif %}{% endif %}",
    variations: [{ id: "standard", name: "Standard", variables: giftCardNotification }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "local_delivered",
    name: "Order locally delivered",
    dir: "local-delivered",
    subject: "Order {{ name }} has been delivered",
    variations: [{ id: "standard", name: "Standard", variables: localDelivered }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "local_missed_delivery",
    name: "Order missed local delivery",
    dir: "local-missed-delivery",
    subject: "Delivery from order {{ name }} has been missed",
    variations: [{ id: "standard", name: "Standard", variables: localMissedDelivery }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "local_out_for_delivery",
    name: "Order out for local delivery",
    dir: "local-out-for-delivery",
    subject: "Order {{ name }} is out for delivery",
    variations: [{ id: "standard", name: "Standard", variables: localOutForDelivery }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "order_cancelled",
    name: "Order canceled",
    dir: "order-cancelled",
    subject: "Order {{ name }} has been canceled",
    variations: [{ id: "standard", name: "Standard", variables: orderCancelled }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "order_confirmation",
    name: "Order confirmation",
    dir: "order-confirmation",
    subject: "Order {{name}} confirmed",
    variations: [{ id: "standard", name: "Standard", variables: orderConfirmation }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "order_edited",
    name: "Order edited",
    dir: "order-edited",
    subject: "Order {{name}} updated",
    variations: [{ id: "standard", name: "Standard", variables: orderEdited }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "order_invoice",
    name: "Order invoice",
    dir: "order-invoice",
    subject: "Invoice {{name}}",
    variations: [{ id: "standard", name: "Standard", variables: orderInvoice }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "order_link",
    name: "Order link",
    dir: "order-link",
    subject: "Link to order {{ order_name }}",
    variations: [{ id: "standard", name: "Standard", variables: orderLink }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "order_payment_receipt",
    name: "Order payment receipt",
    dir: "order-payment-receipt",
    subject: "[{{ shop.name }}] Payment receipt for order {{ name }}",
    variations: [{ id: "standard", name: "Standard", variables: orderPaymentReceipt }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "payment_reminder",
    name: "Payment reminder",
    dir: "payment-reminder",
    subject: "Payment reminder for order {{ name }}",
    variations: [{ id: "standard", name: "Standard", variables: paymentReminder }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "pending_payment_failure",
    name: "Pending payment error",
    dir: "pending-payment-failure",
    subject: "[{{shop.name}}] Payment couldn’t be processed for order {{ name }}",
    variations: [{ id: "standard", name: "Standard", variables: pendingPaymentFailure }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "pending_payment_success",
    name: "Pending payment success",
    dir: "pending-payment-success",
    subject: "[{{ shop.name }}] Payment for {{ name }} has been received",
    variations: [{ id: "standard", name: "Standard", variables: pendingPaymentSuccess }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "pickup_receipt",
    name: "Picked up by customer",
    dir: "pickup-receipt",
    subject: "Your order has been picked up ({{ name }})",
    variations: [{ id: "standard", name: "Standard", variables: pickupReceipt }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "pos_exchange_v2_receipt",
    name: "POS exchange receipt",
    dir: "pos-exchange-v2-receipt",
    subject: "Exchange receipt from {{ shop.name }}",
    variations: [{ id: "standard", name: "Standard", variables: posExchangeV2Receipt }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "pos_send_cart",
    name: "POS email to customer",
    dir: "pos-send-cart",
    subject: "Buy online from {{ shop_name }} when you're ready!",
    variations: [{ id: "standard", name: "Standard", variables: posSendCart }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "ready_for_pickup",
    name: "Ready for local pickup",
    dir: "ready-for-pickup",
    subject: "A package from order {{ name }} is ready for pickup",
    variations: [{ id: "standard", name: "Standard", variables: readyForPickup }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "refund_notification",
    name: "Order refund",
    dir: "refund-notification",
    subject: "Refund notification",
    variations: [{ id: "standard", name: "Standard", variables: refundNotification }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "requested_edit_declined",
    name: "Cancellation request declined",
    dir: "requested-edit-declined",
    subject: "Cancellation request declined for order {{ order.name }}",
    variations: [{ id: "standard", name: "Standard", variables: requestedEditDeclined }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "return_approved",
    name: "Return request approved",
    dir: "return-approved",
    subject: "Return approved for order {{ order.name }}",
    variations: [{ id: "standard", name: "Standard", variables: returnApproved }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "return_created",
    name: "Return created",
    dir: "return-created",
    subject: "Complete your return for Order {{ order.name }}",
    variations: [{ id: "standard", name: "Standard", variables: returnCreated }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "return_declined",
    name: "Return request declined",
    dir: "return-declined",
    subject: "Return request declined for order {{ order.name }}",
    variations: [{ id: "standard", name: "Standard", variables: returnDeclined }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "return_label_notification",
    name: "Order-level return label created",
    dir: "return-label-notification",
    subject: "Return label for order {{ order.name }}",
    variations: [{ id: "standard", name: "Standard", variables: returnLabelNotification }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "return_requested",
    name: "Return request received",
    dir: "return-requested",
    subject: "Return requested for order {{ order.name }}",
    variations: [{ id: "standard", name: "Standard", variables: returnRequested }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "shipment_delivered",
    name: "Delivered",
    dir: "shipment-delivered",
    subject: "A shipment from order {{ name }} has been delivered",
    variations: [{ id: "standard", name: "Standard", variables: shipmentDelivered }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "shipment_out_for_delivery",
    name: "Out for delivery",
    dir: "shipment-out-for-delivery",
    subject: "A shipment from order {{ name }} is out for delivery",
    variations: [{ id: "standard", name: "Standard", variables: shipmentOutForDelivery }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "shipping_confirmation",
    name: "Shipping confirmation",
    dir: "shipping-confirmation",
    subject: "A shipment from order {{ name }} is on the way",
    variations: [{ id: "standard", name: "Standard", variables: shippingConfirmation }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "shipping_update",
    name: "Shipping update",
    dir: "shipping-update",
    subject: "Shipping update for order {{ name }}",
    variations: [{ id: "standard", name: "Standard", variables: shippingUpdate }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "store_credit_issued",
    name: "Store credit issued",
    dir: "store-credit-issued",
    subject: "{{ shop.name }} {{ issued_store_credit.amount | money_without_trailing_zeros }} store credit",
    variations: [{ id: "standard", name: "Standard", variables: storeCreditIssued }]
  },
  {
    type: "email",
    group: "Customer notifications",
    id: "store_receipt",
    name: "POS and mobile receipt",
    dir: "store-receipt",
    subject: "Receipt for order {{name}}",
    variations: [{ id: "standard", name: "Standard", variables: storeReceipt }]
  }
]
