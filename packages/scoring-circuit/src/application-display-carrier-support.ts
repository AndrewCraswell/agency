/** BP-144 carrier-owned, placement-live HUB75 support inventory. */

const resistor10k = "RC0603FR-0710KL"
const resistor100k = "RC0603FR-07100KL"

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-144 carrier support inventory cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-144 carrier support inventory may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  return Object.freeze(value)
}

export const applicationDisplayHub75SupportParts = deepFreeze([
  ...["U_DISPLAY_BUFFER_A", "U_DISPLAY_BUFFER_B"].map((reference) => ({
    reference,
    mpn: "SN74AHCT245PWR",
    value: "octal bus transceiver with 3-state outputs",
    package: "TSSOP-20",
    footprint: "tssop20",
    manufacturer: "Texas Instruments",
    source: "TI SN74AHCT245 data sheet",
    sourceUrl: "https://www.ti.com/lit/ds/symlink/sn74ahct245.pdf"
  })),
  ...[
    "R_HUB75_R1_PD",
    "R_HUB75_G1_PD",
    "R_HUB75_B1_PD",
    "R_HUB75_R2_PD",
    "R_HUB75_G2_PD",
    "R_HUB75_B2_PD",
    "R_HUB75_A_PD",
    "R_HUB75_B_PD",
    "R_HUB75_C_PD",
    "R_HUB75_D_PD",
    "R_HUB75_CLK_PD",
    "R_HUB75_LAT_PD",
    "R_HUB75_OE_PULLUP",
    "R_HUB75_UNUSED_B_A6_PD",
    "R_HUB75_UNUSED_B_A7_PD",
    "R_HUB75_UNUSED_B_A8_PD",
    "R_HUB75_PANEL_OE_PULLUP",
    "R_BUFFER_A_ENABLE_PULLUP",
    "R_BUFFER_A_GATE",
    "R_BUFFER_B_ENABLE_PULLUP",
    "R_BUFFER_B_GATE"
  ].map((reference) => ({
    reference,
    mpn: resistor10k,
    value: "10 kOhm, 1%",
    package: "0603",
    footprint: "0603",
    manufacturer: "Yageo",
    source: "Yageo RC0603FR-0710KL product specification",
    sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-0710KL"
  })),
  ...["R_BUFFER_A_GATE_PD", "R_BUFFER_B_GATE_PD"].map((reference) => ({
    reference,
    mpn: resistor100k,
    value: "100 kOhm, 1%",
    package: "0603",
    footprint: "0603",
    manufacturer: "Yageo",
    source: "Yageo RC0603FR-07100KL product specification",
    sourceUrl: "https://www.yageogroup.com/component-documentation/download/specsheet/RC0603FR-07100KL"
  })),
  ...["C_HUB75_BUF_A_BYPASS", "C_HUB75_BUF_B_BYPASS"].map((reference) => ({
    reference,
    mpn: "C0603C104K3RACTU",
    value: "100 nF X7R",
    package: "0603",
    footprint: "0603",
    manufacturer: "KEMET",
    source: "KEMET C0603C104K3RACTU product specification",
    sourceUrl: "https://search.kemet.com/download/specsheet/C0603C104K3RACTU"
  })),
  ...["Q_DISPLAY_BUFFER_A_ENABLE", "Q_DISPLAY_BUFFER_B_ENABLE"].map((reference) => ({
    reference,
    mpn: "BSS138AKA",
    value: "60 V, single N-channel Trench MOSFET",
    package: "SOT-23",
    footprint: "sot23",
    manufacturer: "Nexperia",
    source: "Nexperia BSS138AKA data sheet",
    sourceUrl: "https://assets.nexperia.com/documents/data-sheet/BSS138AKA.pdf"
  }))
])

export function applicationDisplayHub75SupportPart(reference: string) {
  const matches = applicationDisplayHub75SupportParts.filter((part) => part.reference === reference)
  if (matches.length !== 1)
    throw new RangeError(`BP-144 carrier support inventory is missing or duplicates ${reference}`)
  return matches[0]!
}
