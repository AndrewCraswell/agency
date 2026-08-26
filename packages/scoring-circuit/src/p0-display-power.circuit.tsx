/* oxlint-disable react/no-unknown-property */

import type { ReactElement } from "react"
import {
  benchPrototypeDisplayPowerBranch,
  validateBenchPrototypeDisplayPowerBranch
} from "./bench-prototype-display-power-branch.js"
import {
  p0DisplayFuseFootprint,
  p0DisplayLimiterFootprint,
  p0DisplayPowerPigtailFootprint
} from "./p0-display-power-footprints.js"

const safeOffCircuitState = Object.freeze({
  state: "safe-off",
  releaseState: "deny",
  fabricationAuthorized: false,
  output: "display panel wires disconnected from the eight board landings",
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
 * prototype uses direct V5 protection and eight solder-wire display landings;
 * service disconnect and measurement-link connectors were intentionally
 * removed from the clean-sheet prototype. This block does not authorize
 * assembly, panel connection, layout, or fabrication.
 */
export function P0DisplayPower({ pcbX, pcbY }: { readonly pcbX: number; readonly pcbY: number }): ReactElement {
  return (
    <group name="P0_DISPLAY_POWER" pcbX={pcbX} pcbY={pcbY}>
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
        footprint={p0DisplayLimiterFootprint}
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
        footprint={p0DisplayFuseFootprint}
        pcbX={7}
        pcbY={0}
      />
      <chip
        name="J_DISPLAY_POWER_PIGTAIL"
        kicadSymbolMetadata={{ inBom: false, onBoard: true }}
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
        footprint={p0DisplayPowerPigtailFootprint}
        pcbX={37}
        pcbY={0}
      />

      <trace from="net.V5" to="U_DISPLAY_LIMITER.IN" />
      <trace from="U_DISPLAY_LIMITER.IN" to="U_DISPLAY_LIMITER.EN_UVLO" />
      <trace from="U_DISPLAY_LIMITER.IN" to="C_DISPLAY_BYPASS.pin1" />
      <trace from="U_DISPLAY_LIMITER.IN" to="C_DISPLAY_IN.pin1" />
      <trace from="U_DISPLAY_LIMITER.OUT" to="net.V5_DISPLAY_LIMITED" />
      <trace from="U_DISPLAY_LIMITER.OUT" to="F_DISPLAY.FUSED_IN" />
      <trace from="F_DISPLAY.FUSED_OUT" to="net.V5_DISPLAY_LOAD" />
      <trace from="F_DISPLAY.FUSED_OUT" to="J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_1_A" />
      <trace from="F_DISPLAY.FUSED_OUT" to="J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_1_B" />
      <trace from="F_DISPLAY.FUSED_OUT" to="J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_2_A" />
      <trace from="F_DISPLAY.FUSED_OUT" to="J_DISPLAY_POWER_PIGTAIL.V5_DISPLAY_BRANCH_2_B" />

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
    </group>
  )
}

export function P0DisplayPowerCircuit(): ReactElement {
  return (
    <board title="P0 protected HUB75 display power branch" width="120mm" height="48mm" layers={2}>
      <P0DisplayPower pcbX={0} pcbY={0} />
    </board>
  )
}
