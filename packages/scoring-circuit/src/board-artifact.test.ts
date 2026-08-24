import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import { createReadinessReport, resolveSimulatorPresentationUrl } from "./board-artifact.js"

const reportInput = {
  circuitJson: [{ name: "U_PD", type: "source_component" }],
  criticalPartReadiness: [{ mpn: "TPS25750", productionApproved: false }],
  readiness: {
    canonicalBenchPrototype: false,
    fabricationReady: false,
    retainedArchitectureRouting: { connectionCount: 12, routeCount: 8, unresolvedConnectionCount: 0 }
  }
} as const

function artifactPage(report: object, simulatorUrl: string) {
  return `<a href="${simulatorUrl}">Bout test simulator</a><script type="application/json">${JSON.stringify(
    report,
    null,
    2
  )}</script>`
}

describe("board artifact policy", () => {
  it("keeps identical report and page bytes stable without a wall-clock field", () => {
    const firstReport = createReadinessReport(reportInput)
    const secondReport = createReadinessReport(reportInput)
    const firstPage = artifactPage(firstReport, resolveSimulatorPresentationUrl({}))
    const secondPage = artifactPage(secondReport, resolveSimulatorPresentationUrl({}))

    expect(JSON.stringify(firstReport, null, 2)).toBe(JSON.stringify(secondReport, null, 2))
    expect(createHash("sha256").update(firstPage).digest("hex")).toBe(
      createHash("sha256").update(secondPage).digest("hex")
    )
    expect(firstReport).not.toHaveProperty("generatedAt")
    expect(firstPage).not.toContain("127.0.0.1")
  })

  it("uses a canonical explicitly configured simulator origin", () => {
    expect(resolveSimulatorPresentationUrl({ SCORING_SIMULATOR_ORIGIN: "https://simulator.example.test/" })).toBe(
      "https://simulator.example.test/"
    )
  })

  it.each([
    "simulator.example.test",
    "ftp://simulator.example.test",
    "https://simulator.example.test/board",
    "https://user:password@simulator.example.test/"
  ])("rejects invalid simulator origin configuration: %s", (configuredOrigin) => {
    expect(() => resolveSimulatorPresentationUrl({ SCORING_SIMULATOR_ORIGIN: configuredOrigin })).toThrow(
      "SCORING_SIMULATOR_ORIGIN"
    )
  })
})
