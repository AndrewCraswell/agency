/* oxlint-disable react/no-unknown-property */

import { Fragment, type ReactElement } from "react"
import {
  benchPrototypeDisplayPowerBranch,
  validateBenchPrototypeDisplayPowerBranch
} from "./bench-prototype-display-power-branch.js"
import { bp033Littelfuse0451FuseFootprintEvidence } from "./bp033-littelfuse-0451-fuses.js"
import { bp033MolexLinksProjectFootprintGeometry } from "./bp033-molex-links-project-footprint.js"
import { bp033Tps25947ProjectFootprintGeometry } from "./bp033-tps25947-project-footprint.js"

const limiterFootprint = (
  <footprint name="BP055_TPS25947_RPW0010A_REVIEW_INPUT" originalLayer="top">
    {bp033Tps25947ProjectFootprintGeometry.projectFootprint.pads.map((pad) => (
      <Fragment key={pad.pin}>
        <smtpad
          name={String(pad.pin)}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderMaskMargin="0.05mm"
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[String(pad.pin), pad.role, `pin${pad.pin}`]}
        />
      </Fragment>
    ))}
  </footprint>
)

const fuseFootprint = (
  <footprint name="BP055_LITTELFUSE_451_REVIEW_INPUT" originalLayer="top">
    {bp033Littelfuse0451FuseFootprintEvidence.projectFootprint.pads.map((pad) => (
      <Fragment key={pad.pad}>
        <smtpad
          name={pad.pad}
          pcbX={pad.xMm}
          pcbY={pad.yMm}
          shape="rect"
          solderPasteMargin="-1mm"
          width={`${pad.widthMm}mm`}
          height={`${pad.heightMm}mm`}
          portHints={[pad.pad, pad.terminal, "non-polar"]}
        />
      </Fragment>
    ))}
  </footprint>
)

const measurementLinkFootprint = (
  <footprint name="BP055_MOLEX_39281023_REVIEW_INPUT" originalLayer="top">
    {bp033MolexLinksProjectFootprintGeometry.candidateGeometry.pins.map((pin) => (
      <Fragment key={pin.number}>
        <platedhole
          name={`PIN_${pin.number}`}
          shape="circular_hole_with_rect_pad"
          pcbX={pin.xMm}
          pcbY={pin.yMm}
          holeDiameter="1.4mm"
          rectPadWidth="2.4mm"
          rectPadHeight="2.4mm"
          rectBorderRadius="1.2mm"
          portHints={[`pin${pin.number}`, `circuit${pin.circuit}`]}
        />
      </Fragment>
    ))}
  </footprint>
)

/**
 * The BP-055 output is an eight-contact pigtail boundary rather than a panel
 * receptacle. The Adafruit 4767 cable is a cable assembly, so the generic
 * plated pin header is only a board-side review landing; received cable
 * mating, sharing, and thermal evidence remain denied by the contract.
 */
const displayPowerPigtailFootprint = (
  <footprint name="BP055_ADAFRUIT_4767_CABLE_BOUNDARY_REVIEW" originalLayer="top">
    {Array.from({ length: 8 }, (_, index) => (
      <Fragment key={index + 1}>
        <platedhole
          name={String(index + 1)}
          shape="circular_hole_with_rect_pad"
          pcbX={0}
          pcbY={(index - 3.5) * 3}
          holeDiameter="1.1mm"
          rectPadWidth="2.2mm"
          rectPadHeight="2.2mm"
          rectBorderRadius="1.1mm"
          portHints={[String(index + 1), `pin${index + 1}`]}
        />
      </Fragment>
    ))}
  </footprint>
)

const safeOffCircuitState = Object.freeze({
  state: "safe-off",
  releaseState: "deny",
  fabricationAuthorized: false,
  disconnect: "J_DISPLAY_DISCONNECT open",
  measurementLink: "J_LINK_DISPLAY removed or open; never a power-injection point",
  output: "J_DISPLAY_POWER_PIGTAIL disconnected from the panel",
  signal: "HUB75 buffers disabled, outputs high impedance, and panel OE inactive/high"
})

export const p0DisplayPowerCircuitContract = Object.freeze({
  artifactKind: "p0-display-power-circuit",
  sourceContract: "BP-055 protected HUB75 display-power branch",
  topology: benchPrototypeDisplayPowerBranch.topology,
  safeOff: safeOffCircuitState,
  releaseState: "deny",
  fabricationAuthorized: false
})

export function validateP0DisplayPowerCircuitContract(value: unknown = p0DisplayPowerCircuitContract): true {
  validateBenchPrototypeDisplayPowerBranch(benchPrototypeDisplayPowerBranch)
  if (value !== p0DisplayPowerCircuitContract) {
    throw new RangeError("P0 display-power circuit contract is immutable and must remain fail-closed")
  }
  return true
}

/**
 * Placeable tscircuit review block for the protected HUB75 display branch.
 *
 * The board-side electrical path is rendered for connectivity review. The
 * service disconnect, measurement link, and panel cable remain physically
 * open in the default safe-off procedure; this block does not authorize
 * assembly, panel connection, layout, or fabrication.
 */
export function P0DisplayPowerCircuit(): ReactElement {
  return (
    <board title="P0 protected HUB75 display power branch" width="120mm" height="48mm" layers={2}>
      <pinheader
        name="J_DISPLAY_DISCONNECT"
        manufacturerPartNumber="43650-0200"
        pinCount={2}
        pinLabels={["V5_SOURCE", "V5_DISPLAY_IN"]}
        pcbX={-51}
        pcbY={0}
      />
      <chip
        name="U_DISPLAY_LIMITER"
        manufacturerPartNumber="TPS259474ARPWR"
        pinLabels={{
          pin1: "EN_UVLO",
          pin2: "OVLO",
          pin3: "PG",
          pin4: "PGTH",
          pin5: "IN",
          pin6: "OUT",
          pin7: "DVDT",
          pin8: "GND",
          pin9: "ILM",
          pin10: "ITIMER"
        }}
        footprint={limiterFootprint}
        pcbX={-34}
        pcbY={0}
      />
      <resistor
        name="R_DISPLAY_ILM"
        manufacturerPartNumber="RC0402FR-07698RL"
        resistance="698"
        tolerance="1%"
        footprint="0402"
        pcbX={-24}
        pcbY={-15}
      />
      <capacitor
        name="C_DISPLAY_BYPASS"
        manufacturerPartNumber="C0402C104K3RACTU"
        capacitance="100nF"
        footprint="0402"
        pcbX={-24}
        pcbY={-8}
      />
      <capacitor
        name="C_DISPLAY_IN"
        manufacturerPartNumber="C2012X7S1A226M125AC"
        capacitance="22uF"
        footprint="0805"
        pcbX={-24}
        pcbY={0}
      />
      <capacitor
        name="C_DISPLAY_OUT"
        manufacturerPartNumber="C2012X7S1A226M125AC"
        capacitance="22uF"
        footprint="0805"
        pcbX={-24}
        pcbY={8}
      />
      <capacitor
        name="C_DISPLAY_DVDT"
        manufacturerPartNumber="C0402C222K3RACTU"
        capacitance="2.2nF"
        footprint="0402"
        pcbX={-15}
        pcbY={-15}
      />
      <capacitor
        name="C_DISPLAY_ITIMER"
        manufacturerPartNumber="C0402C222K3RACTU"
        capacitance="2.2nF"
        footprint="0402"
        pcbX={-15}
        pcbY={15}
      />
      <resistor
        name="R_DISPLAY_PG_PULLUP"
        manufacturerPartNumber="RC0402FR-0710KL"
        resistance="10k"
        tolerance="1%"
        footprint="0402"
        pcbX={-4}
        pcbY={-15}
      />
      <resistor
        name="R_DISPLAY_PG_UPPER"
        manufacturerPartNumber="RC0402FR-07137KL"
        resistance="137k"
        tolerance="1%"
        footprint="0402"
        pcbX={-4}
        pcbY={-8}
      />
      <resistor
        name="R_DISPLAY_PG_LOWER"
        manufacturerPartNumber="RC0402FR-0749K9L"
        resistance="49.9k"
        tolerance="1%"
        footprint="0402"
        pcbX={-4}
        pcbY={0}
      />
      <chip
        name="F_DISPLAY"
        manufacturerPartNumber="045106.3MRL"
        pinLabels={{ pin1: "FUSED_IN", pin2: "FUSED_OUT" }}
        footprint={fuseFootprint}
        pcbX={7}
        pcbY={0}
      />
      <pinheader
        name="J_LINK_DISPLAY"
        manufacturerPartNumber="39-28-1023"
        pinCount={2}
        pinLabels={["V5_DISPLAY_LIMITED", "V5_DISPLAY_LOAD"]}
        footprint={measurementLinkFootprint}
        pcbX={18}
        pcbY={0}
      />
      <chip
        name="J_DISPLAY_POWER_PIGTAIL"
        manufacturerPartNumber="4767"
        pinLabels={{
          pin1: "V5_DISPLAY_BRANCH_1_A",
          pin2: "V5_DISPLAY_BRANCH_1_B",
          pin3: "APP_GND_BRANCH_1_A",
          pin4: "APP_GND_BRANCH_1_B",
          pin5: "V5_DISPLAY_BRANCH_2_A",
          pin6: "V5_DISPLAY_BRANCH_2_B",
          pin7: "APP_GND_BRANCH_2_A",
          pin8: "APP_GND_BRANCH_2_B"
        }}
        footprint={displayPowerPigtailFootprint}
        pcbX={37}
        pcbY={0}
      />

      <trace from="net.V5" to="J_DISPLAY_DISCONNECT.V5_SOURCE" />
      <trace from="J_DISPLAY_DISCONNECT.V5_DISPLAY_IN" to="U_DISPLAY_LIMITER.IN" />
      <trace from="U_DISPLAY_LIMITER.IN" to="U_DISPLAY_LIMITER.EN_UVLO" />
      <trace from="U_DISPLAY_LIMITER.IN" to="C_DISPLAY_BYPASS.pin1" />
      <trace from="U_DISPLAY_LIMITER.IN" to="C_DISPLAY_IN.pin1" />
      <trace from="U_DISPLAY_LIMITER.IN" to="net.V5_DISPLAY_IN" />
      <trace from="U_DISPLAY_LIMITER.OUT" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_LIMITER.OUT" to="F_DISPLAY.FUSED_IN" />
      <trace from="F_DISPLAY.FUSED_OUT" to="J_LINK_DISPLAY.V5_DISPLAY_LIMITED" />
      <trace from="J_LINK_DISPLAY.V5_DISPLAY_LOAD" to="net.V5_DISPLAY_LOAD" />
      <trace from="J_LINK_DISPLAY.V5_DISPLAY_LOAD" to="J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_1_A" />
      <trace from="J_LINK_DISPLAY.V5_DISPLAY_LOAD" to="J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_1_B" />
      <trace from="J_LINK_DISPLAY.V5_DISPLAY_LOAD" to="J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_2_A" />
      <trace from="J_LINK_DISPLAY.V5_DISPLAY_LOAD" to="J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_2_B" />

      <trace from="U_DISPLAY_LIMITER.OUT" to="C_DISPLAY_OUT.pin1" />
      <trace from="C_DISPLAY_BYPASS.pin2" to="net.APP_GND" />
      <trace from="C_DISPLAY_IN.pin2" to="net.APP_GND" />
      <trace from="C_DISPLAY_OUT.pin2" to="net.APP_GND" />
      <trace from="U_DISPLAY_LIMITER.GND" to="net.APP_GND" />
      <trace from="U_DISPLAY_LIMITER.OVLO" to="net.APP_GND" />
      <trace from="U_DISPLAY_LIMITER.DVDT" to="C_DISPLAY_DVDT.pin1" />
      <trace from="C_DISPLAY_DVDT.pin2" to="net.APP_GND" />
      <trace from="U_DISPLAY_LIMITER.ILM" to="R_DISPLAY_ILM.pin1" />
      <trace from="R_DISPLAY_ILM.pin2" to="net.APP_GND" />
      <trace from="U_DISPLAY_LIMITER.ITIMER" to="C_DISPLAY_ITIMER.pin1" />
      <trace from="C_DISPLAY_ITIMER.pin2" to="net.APP_GND" />

      <trace from="net.APP_3V3" to="R_DISPLAY_PG_PULLUP.pin1" />
      <trace from="R_DISPLAY_PG_PULLUP.pin2" to="U_DISPLAY_LIMITER.PG" />
      <trace from="net.V5_DISPLAY_LIMITED" to="R_DISPLAY_PG_UPPER.pin1" />
      <trace from="R_DISPLAY_PG_UPPER.pin2" to="U_DISPLAY_LIMITER.PGTH" />
      <trace from="U_DISPLAY_LIMITER.PGTH" to="R_DISPLAY_PG_LOWER.pin1" />
      <trace from="R_DISPLAY_PG_LOWER.pin2" to="net.APP_GND" />

      <trace from="J_DISPLAY_POWER_PIGTAIL.APP_GND_BRANCH_1_A" to="net.APP_GND" />
      <trace from="J_DISPLAY_POWER_PIGTAIL.APP_GND_BRANCH_1_B" to="net.APP_GND" />
      <trace from="J_DISPLAY_POWER_PIGTAIL.APP_GND_BRANCH_2_A" to="net.APP_GND" />
      <trace from="J_DISPLAY_POWER_PIGTAIL.APP_GND_BRANCH_2_B" to="net.APP_GND" />
    </board>
  )
}

export default P0DisplayPowerCircuit
