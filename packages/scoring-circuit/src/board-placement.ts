import { cleanSheetBoardArchitecture } from "./clean-sheet-board-architecture.js"

type Placement = {
  readonly pcbX: number
  readonly pcbY: number
}

type PlacementBox = Placement & {
  readonly heightMm: number
  readonly name: string
  readonly widthMm: number
}

function bounds({ heightMm, pcbX, pcbY, widthMm }: PlacementBox) {
  return {
    maximumX: pcbX + widthMm / 2,
    maximumY: pcbY + heightMm / 2,
    minimumX: pcbX - widthMm / 2,
    minimumY: pcbY - heightMm / 2
  }
}

function overlaps(first: PlacementBox, second: PlacementBox): boolean {
  const firstBounds = bounds(first)
  const secondBounds = bounds(second)
  return !(
    firstBounds.maximumX <= secondBounds.minimumX ||
    firstBounds.minimumX >= secondBounds.maximumX ||
    firstBounds.maximumY <= secondBounds.minimumY ||
    firstBounds.minimumY >= secondBounds.maximumY
  )
}

/**
 * Deliberate P0 component islands. Coordinates are board-centre millimetres.
 * The top-edge ESP32 antenna reserve is intentionally exclusive: all cable
 * interfaces and other islands stay outside it.
 */
export const p0BoardPlacement = Object.freeze({
  board: {
    edgeClearanceMm: 6,
    heightMm: cleanSheetBoardArchitecture.board.provisionalHeightMm,
    widthMm: cleanSheetBoardArchitecture.board.provisionalWidthMm
  },
  islands: {
    analog: { pcbX: -45, pcbY: -60 },
    displayPower: { pcbX: 95, pcbY: 55 },
    esp32: { pcbX: 0, pcbY: 69.5 },
    irReceiver: { pcbRotation: 180, pcbX: 145, pcbY: 87 },
    primaryOutputs: { pcbX: 25, pcbY: 10 },
    usbPower: { pcbX: -104, pcbY: 35 },
    weapon: { pcbRotation: 90, pcbX: -145, pcbY: 0 },
    piste: { pcbX: -150, pcbY: 84.7 },
    digital: {
      ethernet: { pcbX: 160, pcbY: -55 },
      hub75: { pcbX: 165, pcbY: 20 },
      pcbX: 125,
      pcbY: -60
    }
  },
  antennaKeepout: {
    heightMm: 36,
    name: "ESP32 antenna keepout",
    pcbX: 0,
    pcbY: 82,
    widthMm: 48
  },
  // Conservative project envelopes for P0 placement collision review. They
  // are deliberately not a substitute for manufacturer assembly courtyards.
  projectCourtyardEnvelopes: [
    { heightMm: 22, name: "direct weapon landing", pcbX: -154.3, pcbY: 3.81, widthMm: 31.8 },
    { heightMm: 18, name: "piste landing", pcbX: -150, pcbY: 85, widthMm: 14 },
    { heightMm: 18, name: "USB-C entry", pcbX: -166, pcbY: 37.21, widthMm: 16 },
    { heightMm: 24, name: "RJ45", pcbX: 164.445, pcbY: -51.02075, widthMm: 16 },
    { heightMm: 24, name: "HUB75", pcbX: 166.27, pcbY: 28.89, widthMm: 14 },
    { heightMm: 14, name: "IR receiver", pcbX: 142.46, pcbY: 84.6, widthMm: 24 },
    { heightMm: 26, name: "ESP32 module", pcbX: 0, pcbY: 79.625, widthMm: 18 },
    { heightMm: 18, name: "display power landing", pcbX: 132, pcbY: 55, widthMm: 24 }
  ] satisfies readonly PlacementBox[],
  intent: Object.freeze({
    analog: "Keep the phased source, sink, sense, ADC, and reference island below the ESP32 antenna reserve.",
    cableFacing:
      "USB-C enters from the upper left; weapon/piste wires use the left edge; RJ45 and HUB75 leave from the right.",
    irReceiver: "Place the optical receiver at the outward top-right edge, outside the ESP32 antenna keepout.",
    outputs: "Keep the white indicators and buzzer at distinct right-side coordinates.",
    rf: "The ESP32 antenna keepout reaches the top board edge and contains no other placement island."
  })
} as const)

export function validateP0BoardPlacement(value: typeof p0BoardPlacement = p0BoardPlacement): true {
  const halfWidth = value.board.widthMm / 2
  const halfHeight = value.board.heightMm / 2
  if (
    value.board.widthMm !== cleanSheetBoardArchitecture.board.provisionalWidthMm ||
    value.board.heightMm !== cleanSheetBoardArchitecture.board.provisionalHeightMm ||
    value.board.edgeClearanceMm <= 0 ||
    value.islands.esp32.pcbX !== value.antennaKeepout.pcbX ||
    value.islands.esp32.pcbY + 12.5 !== value.antennaKeepout.pcbY ||
    value.islands.irReceiver.pcbRotation !== 180 ||
    bounds(value.antennaKeepout).maximumY !== halfHeight
  ) {
    throw new RangeError("P0 placement must bind the ESP32 antenna keepout to the top board edge")
  }

  const envelopes = value.projectCourtyardEnvelopes
  if (new Set(envelopes.map(({ name }) => name)).size !== envelopes.length) {
    throw new RangeError("P0 placement envelopes must have unique names")
  }
  for (const envelope of envelopes) {
    const envelopeBounds = bounds(envelope)
    if (
      envelope.widthMm <= 0 ||
      envelope.heightMm <= 0 ||
      envelopeBounds.minimumX < -halfWidth + value.board.edgeClearanceMm ||
      envelopeBounds.maximumX > halfWidth - value.board.edgeClearanceMm ||
      envelopeBounds.minimumY < -halfHeight + value.board.edgeClearanceMm ||
      envelopeBounds.maximumY > halfHeight - value.board.edgeClearanceMm
    ) {
      throw new RangeError(`${envelope.name} must remain inside the P0 board-edge clearance`)
    }
  }

  const byName = new Map(envelopes.map((envelope) => [envelope.name, envelope]))
  const weapon = byName.get("direct weapon landing")
  const piste = byName.get("piste landing")
  const usb = byName.get("USB-C entry")
  const ethernet = byName.get("RJ45")
  const hub75 = byName.get("HUB75")
  const irReceiver = byName.get("IR receiver")
  const app = byName.get("ESP32 module")
  const displayPower = byName.get("display power landing")
  if (
    weapon === undefined ||
    piste === undefined ||
    usb === undefined ||
    ethernet === undefined ||
    hub75 === undefined ||
    irReceiver === undefined ||
    app === undefined ||
    displayPower === undefined ||
    weapon.pcbX !== value.islands.weapon.pcbX - 9.3 ||
    weapon.pcbY !== value.islands.weapon.pcbY + 3.81 ||
    piste.pcbX !== value.islands.piste.pcbX ||
    piste.pcbY !== value.islands.piste.pcbY + 0.3 ||
    usb.pcbX !== value.islands.usbPower.pcbX - 62 ||
    usb.pcbY !== value.islands.usbPower.pcbY + 2.21 ||
    ethernet.pcbX !== value.islands.digital.ethernet.pcbX + 4.445 ||
    ethernet.pcbY !== value.islands.digital.ethernet.pcbY + 3.97925 ||
    hub75.pcbX !== value.islands.digital.hub75.pcbX + 1.27 ||
    hub75.pcbY !== value.islands.digital.hub75.pcbY + 8.89 ||
    irReceiver.pcbX !== value.islands.irReceiver.pcbX - 2.54 ||
    irReceiver.pcbY !== value.islands.irReceiver.pcbY - 2.4 ||
    app.pcbX !== value.islands.esp32.pcbX ||
    app.pcbY !== value.islands.esp32.pcbY + 10.125 ||
    displayPower.pcbX !== value.islands.displayPower.pcbX + 37 ||
    displayPower.pcbY !== value.islands.displayPower.pcbY ||
    overlaps(weapon, piste) ||
    overlaps(weapon, usb) ||
    overlaps(ethernet, hub75) ||
    overlaps(hub75, displayPower) ||
    overlaps(irReceiver, value.antennaKeepout) ||
    overlaps(ethernet, value.antennaKeepout) ||
    overlaps(hub75, value.antennaKeepout) ||
    overlaps(displayPower, value.antennaKeepout) ||
    overlaps(app, value.antennaKeepout) === false ||
    value.islands.weapon.pcbX <= -halfWidth + value.board.edgeClearanceMm ||
    value.islands.irReceiver.pcbY <= 0 ||
    value.islands.digital.ethernet.pcbX <= 0 ||
    value.islands.digital.hub75.pcbX <= 0
  ) {
    throw new RangeError("P0 placement must retain separate cable islands and an exclusive antenna keepout")
  }
  return true
}

validateP0BoardPlacement()
