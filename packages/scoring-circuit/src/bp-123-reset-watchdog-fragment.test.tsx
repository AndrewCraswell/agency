import { createHash } from "node:crypto"
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { benchPrototypeResetWatchdog } from "./bench-prototype-reset-watchdog.js"
import Bp123ResetWatchdogFragmentCircuit, {
  bp123ResetWatchdogFragmentContract,
  bp123ResetWatchdogFragmentEvidence,
  bp123ResetWatchdogFragmentGeometry,
  bp123ResetWatchdogGeometryNetDigest,
  bp123ResetWatchdogPreflightNets,
  validateBp123ResetWatchdogFragment
} from "./bp-123-reset-watchdog-fragment.circuit.js"
import { renderTestCircuit } from "./test-helper.js"

function renderCircuit() {
  return renderTestCircuit(createElement(Bp123ResetWatchdogFragmentCircuit), { pcbEnabled: false })
}

function digestFragmentContract() {
  return createHash("sha256")
    .update(JSON.stringify({ geometry: bp123ResetWatchdogFragmentGeometry, nets: bp123ResetWatchdogPreflightNets }))
    .digest("hex")
}

function traceNames(circuitJson: ReturnType<typeof renderCircuit>): string[] {
  return circuitJson.flatMap((element) =>
    element.type === "source_trace" && "display_name" in element && typeof element.display_name === "string"
      ? [element.display_name]
      : []
  )
}

function renderablePort(endpoint: string): string {
  if (endpoint === "TP_W5500_RESET_N") return "TP_W5500_RESET_N.RESET_N"
  return endpoint
    .replace(/\([^)]*\)/u, "")
    .replace(/@\d+$/u, "")
    .replace(/\.([12])$/u, ".pin$1")
}

function connectedPorts(traces: readonly string[], start: string): Set<string> {
  const ports = new Set([start])
  let changed = true
  while (changed) {
    changed = false
    for (const trace of traces) {
      const [from, to, ...extra] = trace.split(" to ")
      if (from === undefined || to === undefined || extra.length > 0)
        throw new RangeError(`Malformed rendered trace: ${trace}`)
      if (ports.has(from) && !ports.has(to)) {
        ports.add(to)
        changed = true
      }
      if (ports.has(to) && !ports.has(from)) {
        ports.add(from)
        changed = true
      }
    }
  }
  return ports
}

function expectCanonicalNetsToBeDisjoint(traces: readonly string[]): void {
  const endpointOwners = new Map<string, string>()
  for (const requirement of bp123ResetWatchdogPreflightNets) {
    for (const port of requirement.endpoints.map(renderablePort)) {
      const existingOwner = endpointOwners.get(port)
      if (existingOwner !== undefined && existingOwner !== requirement.net) {
        throw new RangeError(`${port} is owned by both ${existingOwner} and ${requirement.net}`)
      }
      endpointOwners.set(port, requirement.net)
    }
  }
  for (const requirement of bp123ResetWatchdogPreflightNets) {
    const component = connectedPorts(traces, renderablePort(requirement.endpoints[0]!))
    for (const [port, owner] of endpointOwners) {
      if (owner !== requirement.net && component.has(port)) {
        throw new RangeError(`${requirement.net} is shorted to ${owner} through ${port}`)
      }
    }
  }
}

describe("BP-123 reset/watchdog fragment", () => {
  it("renders the exact supervisor, watchdog, fanout, transistor, and passive identities without component or port errors", () => {
    const circuitJson = renderCircuit()
    const serialized = JSON.stringify(circuitJson)
    const errors = circuitJson.filter((element) => element.type.includes("error"))
    const components = circuitJson.filter((element) => element.type === "source_component")
    const componentNames = components.map((component) => component.name)

    expect(errors).toEqual([])
    expect(componentNames).toEqual(
      expect.arrayContaining([
        "U_STM_SUPERVISOR",
        "U_STM_WATCHDOG",
        "U_ESP_SUPERVISOR",
        "U_ESP_WATCHDOG",
        "U_APP_RESET_FANOUT",
        "Q_ESP_RESET_STM",
        "Q_ESP_DEBUG_RESET"
      ])
    )
    expect(serialized).toContain("TPS389033DSER")
    expect(serialized).toContain("TPS3431SDRBR")
    expect(serialized).toContain("SN74LVC2G07DCKR")
    expect(serialized).toContain("BSS138AKA")
    expect(serialized).toContain("RC0603FR-0710KL")
    expect(serialized).toContain("RC0603FR-07100KL")
    expect(serialized).toContain("C0603C104K3RACTU")
    expect(serialized).toContain("C1608X5R1A105K080AC")
  })

  it("keeps every BP-123 preflight net and endpoint ordered exactly", () => {
    expect(bp123ResetWatchdogPreflightNets).toBe(benchPrototypeResetWatchdog.schematicIntegrationPreflight.requiredNets)
    expect(bp123ResetWatchdogPreflightNets).toHaveLength(11)
    expect(bp123ResetWatchdogPreflightNets.map((entry) => entry.net)).toEqual([
      "SCORING_NRST_N",
      "SCORING_WATCHDOG_WDI",
      "APP_WD_KICK",
      "EN_RESET",
      "APP_SUPERVISOR_RESET_N",
      "APP_W5500_RESET_N",
      "ESP32_RESET_ASSERT_ISOLATED",
      "ESP32_RESET_ASSERT",
      "RESET_REQUEST",
      "SCORING_SGND",
      "APP_GND"
    ])
    expect(bp123ResetWatchdogPreflightNets[0]?.endpoints).toEqual([
      "U_STM32.NRST@7",
      "U_STM_SUPERVISOR.RESET",
      "U_STM_WATCHDOG.WDO",
      "U_STM_WATCHDOG.ENOUT",
      "R_STM_NRST_PULLUP.2",
      "C_STM_NRST_FILTER.1",
      "J_STM_SWD.NRST(open-drain-sink-only)"
    ])
    expect(bp123ResetWatchdogPreflightNets[10]?.endpoints).toEqual([
      "U_ESP_SUPERVISOR.GND",
      "U_ESP_WATCHDOG.GND",
      "U_APP_RESET_FANOUT.GND",
      "C_ESP_SUPERVISOR_CT.2",
      "C_ESP_SUPERVISOR_BYPASS.2",
      "C_ESP_WD_BYPASS.2",
      "C_APP_RESET_FANOUT_BYPASS.2",
      "C_ESP_EN_DELAY.2",
      "R_STM_RESET_GATE_PD.2",
      "R_DEBUG_RESET_GATE_PD.2",
      "Q_ESP_RESET_STM.S",
      "Q_ESP_DEBUG_RESET.S"
    ])
  })

  it("renders each canonical net as one connected and mutually disjoint endpoint set", () => {
    const traces = traceNames(renderCircuit())
    for (const requirement of bp123ResetWatchdogPreflightNets) {
      const expectedPorts = requirement.endpoints.map(renderablePort)
      const actualPorts = connectedPorts(traces, expectedPorts[0]!)
      for (const port of expectedPorts) expect(actualPorts, requirement.net).toContain(port)
    }
    expectCanonicalNetsToBeDisjoint(traces)

    const crossNetShortWitness = [...traces, "U_STM32.NRST to U_ESP32.EN"]
    expect(() => expectCanonicalNetsToBeDisjoint(crossNetShortWitness)).toThrow(
      /SCORING_NRST_N is shorted to EN_RESET/u
    )
  })

  it("locks the geometry and net contract to an immutable digest", () => {
    expect(Object.isFrozen(bp123ResetWatchdogFragmentGeometry)).toBe(true)
    expect(Object.isFrozen(bp123ResetWatchdogFragmentGeometry[0])).toBe(true)
    expect(Object.isFrozen(bp123ResetWatchdogPreflightNets)).toBe(true)
    expect(Object.isFrozen(bp123ResetWatchdogPreflightNets[0]?.endpoints)).toBe(true)
    expect(digestFragmentContract()).toBe(bp123ResetWatchdogGeometryNetDigest)
  })

  it("retains false integration, fabrication, and physical-evidence state", () => {
    expect(bp123ResetWatchdogFragmentEvidence).toEqual({
      bp300SchematicSource: false,
      ercReport: false,
      fabrication: false,
      physicalEvidence: false,
      schematicIntegrationAuthorized: false
    })
  })

  it("fails closed for altered net lists or authority escalation", () => {
    expect(validateBp123ResetWatchdogFragment(bp123ResetWatchdogFragmentContract)).toBe(true)

    const copiedNets = structuredClone(bp123ResetWatchdogFragmentContract)
    Reflect.set(copiedNets.requiredNets[3]!.endpoints, 0, "U_ESP32.GPIO12@20")
    expect(() => validateBp123ResetWatchdogFragment(copiedNets)).toThrow(/exactly match/u)

    const unauthorizedEvidence = structuredClone(bp123ResetWatchdogFragmentContract)
    Reflect.set(unauthorizedEvidence.evidence, "ercReport", true)
    expect(() => validateBp123ResetWatchdogFragment(unauthorizedEvidence)).toThrow(/exactly match/u)
  })
})
