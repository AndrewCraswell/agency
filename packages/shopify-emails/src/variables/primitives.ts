/*
 * The value shapes every notification's variables are built from, transcribed from live probe runs against
 * the admin's preview renderer rather than from documentation.
 *
 * Read these as a floor, not a ceiling. `json` serialises a drop's backing hash and Shopify layers
 * computed methods on top, so a name absent here may still resolve at send time. A name present
 * here is settled. Nullability mirrors what the synthetic sample order happened to carry, so a
 * `| null` means "the sample left it empty", not "Shopify will never fill it".
 */

/** Money is always integer cents, and can be negative where the order owes the customer. */
export type Cents = number

/** Ruby's `Time#to_a`: second, minute, hour, day, month, year, weekday, yearday, DST, zone. */
export type LiquidTime = readonly [number, number, number, number, number, number, number, number, boolean, string]

/*
 * A drop `json` refuses, answering `{"error":"json not allowed for this object"}`. The drop is
 * present and its properties resolve; only the dump does not. Probe those properties by name.
 */
export type OpaqueDrop = { readonly error: string }

/** Namespace to key to value. The drop itself is opaque, but each namespace serialises. */
export type Metafields = Readonly<Record<string, Readonly<Record<string, unknown>>>>

export type OrderAddress = {
  readonly address1: string
  readonly address2: string | null
  readonly city: string
  readonly company: string | null
  readonly country: string
  readonly country_code: string
  readonly first_name: string
  readonly last_name: string
  readonly latitude: number | null
  readonly longitude: number | null
  readonly name: string
  readonly phone: string | null
  readonly province: string
  readonly province_code: string
  readonly zip: string
}

/** The customer's saved address, which carries its own identifiers on top of an order address. */
export type CustomerAddress = OrderAddress & {
  readonly customer_id: number
  readonly id: number
}

export type ShopAddress = {
  readonly address1: string
  readonly address2: string | null
  readonly city: string
  readonly country: string
  readonly first_name: string | null
  readonly last_name: string | null
  readonly phone: string | null
  readonly province: string
  readonly zip: string
}
