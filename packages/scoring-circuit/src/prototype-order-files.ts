import type { CircuitJson } from "circuit-json"

export type PrototypeBomRow = {
  readonly manufacturerPartNumber: string
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
    .map((group) => ({
      displayValue: group[0]?.displayValue ?? "",
      manufacturerPartNumber: group[0]?.manufacturerPartNumber ?? "",
      quantity: group.length,
      references: group.map(({ reference }) => reference).toSorted()
    }))
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
      ["manufacturer_part_number", "display_value", "quantity", "references"],
      bom.map((row) => [row.manufacturerPartNumber, row.displayValue, row.quantity, row.references.join(";")])
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
