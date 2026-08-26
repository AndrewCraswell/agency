import { prototypeCarrierArchitecture } from "./clean-sheet-board-architecture.js"

/** Roomy bench placement. Compactness is intentionally not a prototype goal. */
export const p0BoardPlacement = {
  board: {
    edgeClearanceMm: 6,
    heightMm: prototypeCarrierArchitecture.board.heightMm,
    widthMm: prototypeCarrierArchitecture.board.widthMm
  },
  islands: {
    analog: { pcbX: -30, pcbY: -30 },
    displayPower: { pcbX: 55, pcbY: 48 },
    esp32: { pcbX: 55, pcbY: 58 },
    irReceiver: { pcbRotation: 180, pcbX: 108, pcbY: 75 },
    primaryOutputs: { pcbX: 65, pcbY: -28 },
    usbPower: { pcbX: -38, pcbY: 55 },
    weapon: { pcbRotation: 90, pcbX: -105, pcbY: -25 },
    piste: { pcbX: -110, pcbY: 70 },
    digital: {
      ethernet: { pcbX: 105, pcbY: -52 },
      hub75: { pcbX: 108, pcbY: 18 },
      pcbX: 80,
      pcbY: -60
    }
  }
} as const
