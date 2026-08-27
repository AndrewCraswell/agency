import type { CircuitJson } from "circuit-json"

export type PrototypeBomRow = {
  readonly estimatedExtendedPriceUsd: number
  readonly estimatedUnitPriceUsd: number
  readonly manufacturerPartNumber: string
  readonly priceCheckedOn: string
  readonly priceSourceUrl: string
  readonly displayValue: string
  readonly quantity: number
  readonly references: readonly string[]
}

export type PrototypePlacementRow = {
  readonly reference: string
  readonly centerXmm: number
  readonly centerYmm: number
  readonly layer: "top" | "bottom"
  readonly rotation: number
}

const priceCheckedOn = "2026-08-27"

const estimatedUnitPriceUsdByMpn = {
  "1N4004-E3/54": [0.56, "https://www.digikey.com/en/products/detail/754810"],
  "4N32M": [0.84, "https://www.digikey.com/en/products/detail/976526"],
  "5520250-2": [2.21, "https://www.digikey.com/en/product-highlight/t/te-connectivity/modular-jack-connectors"],
  "5807": [5.95, "https://www.adafruit.com/product/5807"],
  "645004114822": [3, "https://www.we-online.com/components/products/datasheet/645004114822.pdf"],
  "BSS138-7-F": [0.23, "https://www.digikey.com/en/products/detail/717843"],
  C0603C104K3RACTU: [0.1, "https://www.digikey.com/en/products/detail/416044"],
  C2012X5R1A226M085AC: [0.31, "https://www.digikey.com/en/products/detail/2733098"],
  D36V50F5: [39.95, "https://www.pololu.com/product/4091"],
  "ESP32-S3-DevKitC-1-N8R8": [15, "https://www.mouser.com/ProductDetail/356-ESP32-S3DVKCN8R8"],
  "PREC001SAAN-RC": [0.29, "https://www.digikey.com/en/products/detail/2774853"],
  "PREC003SAAN-RC": [0.32, "https://www.digikey.com/en/products/detail/2774851"],
  "PPTC221LFBN-RC": [1.36, "https://www.digikey.com/en/products/detail/810160"],
  PS1240P02BT: [0.57, "https://www.digikey.com/en/products/detail/445-2525-1-ND"],
  "RC0603FR-07100KL": [0.1, "https://www.digikey.com/en/products/detail/726889"],
  "RC0603FR-07100RL": [0.1, "https://www.digikey.com/en/products/result?keywords=RC0603FR-07100RL"],
  "RC0603FR-071KL": [0.1, "https://www.digikey.com/en/products/result?keywords=RC0603FR-071KL"],
  "RC0805FR-0733RL": [0.1, "https://www.digikey.com/en/products/result?keywords=RC0805FR-0733RL"],
  "RC0805FR-07470RL": [0.1, "https://www.digikey.com/en/products/result?keywords=RC0805FR-07470RL"],
  "RC0805FR-07680KL": [0.1, "https://www.digikey.com/en/products/result?keywords=RC0805FR-07680KL"],
  "RC0805FR-0782RL": [0.1, "https://www.digikey.com/en/products/result?keywords=RC0805FR-0782RL"],
  TSOP38438: [0.84, "https://www.digikey.com/en/products/detail/4073478"],
  "TST-108-02-G-D": [3.5, "https://www.digikey.com/en/products/detail/9497431"],
  WIZ850io: [22.12, "https://www.digikey.com/en/products/detail/8789619"]
} as const satisfies Record<string, readonly [estimatedUnitPriceUsd: number, priceSourceUrl: string]>

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`
}

function csvDocument(header: readonly string[], rows: readonly (readonly (string | number)[])[]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")
}

export function createPrototypeOrderFiles(circuitJson: CircuitJson) {
  const placements = new Map(
    circuitJson.flatMap((element) =>
      element.type === "pcb_component" ? [[element.source_component_id, element] as const] : []
    )
  )
  const components = circuitJson.flatMap((element) => {
    if (element.type !== "source_component" || !element.manufacturer_part_number) return []
    const placement = placements.get(element.source_component_id)
    if (placement === undefined) throw new TypeError(`Missing PCB placement for ${element.name}`)
    if (placement.do_not_place) return []
    if (placement.layer !== "top" && placement.layer !== "bottom") {
      throw new TypeError(`Populated component ${element.name} must be on the top or bottom layer`)
    }
    return [
      {
        displayValue: element.display_value ?? "",
        manufacturerPartNumber: element.manufacturer_part_number,
        placement,
        reference: element.name ?? element.source_component_id
      }
    ]
  })

  const grouped = Map.groupBy(
    components,
    (component) => `${component.manufacturerPartNumber}\u0000${component.displayValue}`
  )
  const bom: PrototypeBomRow[] = [...grouped.values()]
    .map((group) => {
      const manufacturerPartNumber = group[0]?.manufacturerPartNumber ?? ""
      const price = estimatedUnitPriceUsdByMpn[manufacturerPartNumber as keyof typeof estimatedUnitPriceUsdByMpn]
      const [estimatedUnitPriceUsd, priceSourceUrl] = price ?? [0, ""]
      return {
        displayValue: group[0]?.displayValue ?? "",
        estimatedExtendedPriceUsd: Number((estimatedUnitPriceUsd * group.length).toFixed(2)),
        estimatedUnitPriceUsd,
        manufacturerPartNumber,
        priceCheckedOn,
        priceSourceUrl,
        quantity: group.length,
        references: group.map(({ reference }) => reference).toSorted()
      }
    })
    .toSorted((left, right) =>
      `${left.manufacturerPartNumber}\u0000${left.displayValue}`.localeCompare(
        `${right.manufacturerPartNumber}\u0000${right.displayValue}`
      )
    )
  const placement: PrototypePlacementRow[] = components
    .map((component) => {
      const layer = component.placement.layer
      if (layer !== "top" && layer !== "bottom")
        throw new TypeError(`Invalid placement layer for ${component.reference}`)
      return {
        centerXmm: component.placement.center.x,
        centerYmm: component.placement.center.y,
        layer,
        reference: component.reference,
        rotation: component.placement.rotation
      }
    })
    .toSorted((left, right) => left.reference.localeCompare(right.reference))

  return {
    bom,
    placement,
    bomCsv: csvDocument(
      [
        "manufacturer_part_number",
        "display_value",
        "quantity",
        "references",
        "estimated_unit_price_usd",
        "estimated_extended_price_usd",
        "price_checked_on",
        "price_source_url"
      ],
      bom.map((row) => [
        row.manufacturerPartNumber,
        row.displayValue,
        row.quantity,
        row.references.join(";"),
        row.estimatedUnitPriceUsd.toFixed(2),
        row.estimatedExtendedPriceUsd.toFixed(2),
        row.priceCheckedOn,
        row.priceSourceUrl
      ])
    ),
    placementCsv: csvDocument(
      ["reference", "center_x_mm", "center_y_mm", "layer", "rotation_deg"],
      placement.map((row) => [row.reference, row.centerXmm, row.centerYmm, row.layer, row.rotation])
    )
  }
}

export function createPrototypeBomCsv(circuitJson: CircuitJson): string {
  return createPrototypeOrderFiles(circuitJson).bomCsv
}

export function createPrototypePlacementCsv(circuitJson: CircuitJson): string {
  return createPrototypeOrderFiles(circuitJson).placementCsv
}
