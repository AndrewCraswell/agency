import type { Cents, LiquidTime, OpaqueDrop } from "./primitives.ts"

/*
 * Who the gift card was issued against. The probe's card had none, so only the three identity
 * fields the stock notification reads are claimed.
 */
export type GiftCardCustomer = {
  readonly email: string | null
  readonly name: string | null
  readonly phone: string | null
}

export type GiftCard = {
  readonly balance: Cents
  readonly code: string
  readonly currency: string
  /** Null unless an admin issued the card against a customer record. */
  readonly customer: GiftCardCustomer | null
  readonly expires_on: string | null
  readonly initial_value: Cents
  /** Lower-cased, so print it through `upcase` beside a masked code. */
  readonly last_four_characters: string
  readonly masked_code: string | null
  readonly message: string | null
  /** An Apple Wallet pass, absent unless the shop has the feature turned on. */
  readonly pass_url: string | null
  readonly product_title: string | null
  readonly qr_identifier: string
  /** Opaque, and present only where the buyer addressed the card to someone else. */
  readonly recipient: OpaqueDrop | null
  readonly send_on: string | null
  readonly url: string
}

export type IssuedStoreCredit = {
  readonly amount: Cents
  readonly balance_after_transaction: Cents
  readonly expires_at: LiquidTime | null
}

export type PaymentSchedule = {
  readonly amount_due: Cents
  readonly completed_at: LiquidTime | null
  readonly due_at: LiquidTime
  readonly issued_at: LiquidTime | null
  readonly number_of_days_overdue: number
  readonly "overdue?": boolean
}

export type PaymentTerms = {
  readonly automatic_capture_at_fulfillment: boolean
  readonly due_in_days: number | null
  /** Opaque; the stock templates only test it for presence and read its schedule through it. */
  readonly next_payment: OpaqueDrop | null
  readonly payment_terms_name: string | null
  /** Already localised by Shopify, unlike every other value here. */
  readonly translated_name: string
  readonly type: "fixed" | "fulfillment" | "net" | "receipt"
}
