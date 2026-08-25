import { createHash } from "node:crypto"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { createElement } from "react"
import { Circuit } from "tscircuit"
import Bp123ResetWatchdogFragmentCircuit, {
  bp123ResetWatchdogFragmentEvidence,
  bp123ResetWatchdogGeometryNetDigest
} from "./bp-123-reset-watchdog-fragment.circuit.js"

const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex")

export const bp123ResetWatchdogFragmentArtifactPaths = Object.freeze({
  ercReport: "docs/evidence/bp-123/bp-123-reset-watchdog-fragment.erc.json",
  manifest: "docs/evidence/bp-123/bp-123-reset-watchdog-fragment.sha256",
  schematicSvg: "docs/evidence/bp-123/bp-123-reset-watchdog-fragment.schematic.svg",
  source: "src/bp-123-reset-watchdog-fragment.circuit.tsx"
})

export type Bp123ResetWatchdogFragmentErcReport = {
  readonly artifactKind: "bp-123-reset-watchdog-fragment-render-erc-report"
  readonly authority: typeof bp123ResetWatchdogFragmentEvidence
  readonly canonicalNetDigestSha256: string
  readonly erc: {
    readonly componentErrorCount: 0
    readonly errorElementTypes: readonly []
    readonly portErrorCount: 0
    readonly totalErrorCount: 0
  }
  readonly scope: "rendered-review-fragment-only"
  readonly source: { readonly path: string; readonly sha256: string }
  readonly schematicSvg: { readonly path: string; readonly sha256: string }
}

export function renderBp123ResetWatchdogFragmentSchematic(): {
  readonly errorElementTypes: readonly string[]
  readonly schematicSvg: string
} {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.pcbRoutingDisabled = true
  circuit.setPlatform({ partsEngineDisabled: true })
  circuit.add(createElement(Bp123ResetWatchdogFragmentCircuit))
  circuit.render()
  const circuitJson = circuit.getCircuitJson()
  const errorElementTypes = circuitJson
    .flatMap((element) => (element.type.endsWith("_error") ? [element.type] : []))
    .sort()
  return {
    errorElementTypes,
    schematicSvg: convertCircuitJsonToSchematicSvg(circuitJson, { includeVersion: false })
  }
}

export function createBp123ResetWatchdogFragmentErcReport(
  sourceSha256: string,
  schematicSvg: string,
  errorElementTypes: readonly string[]
): Bp123ResetWatchdogFragmentErcReport {
  if (errorElementTypes.length > 0) {
    throw new RangeError(`BP-123 fragment render has errors: ${errorElementTypes.join(", ")}`)
  }
  return {
    artifactKind: "bp-123-reset-watchdog-fragment-render-erc-report",
    authority: bp123ResetWatchdogFragmentEvidence,
    canonicalNetDigestSha256: bp123ResetWatchdogGeometryNetDigest,
    erc: {
      componentErrorCount: 0,
      errorElementTypes: [],
      portErrorCount: 0,
      totalErrorCount: 0
    },
    scope: "rendered-review-fragment-only",
    source: { path: bp123ResetWatchdogFragmentArtifactPaths.source, sha256: sourceSha256 },
    schematicSvg: { path: bp123ResetWatchdogFragmentArtifactPaths.schematicSvg, sha256: sha256(schematicSvg) }
  }
}

function hasExactKeys(value: unknown, expectedKeys: readonly string[]): value is Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false
  const actualKeys = Object.keys(value)
  return actualKeys.length === expectedKeys.length && expectedKeys.every((key) => actualKeys.includes(key))
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

/**
 * Validates only a deterministic fragment-render report. It never credits a
 * BP-300 schematic/ERC run, independent review, or physical evidence.
 */
export function validateBp123ResetWatchdogFragmentErcReport(
  value: unknown,
  sourceSha256: string,
  schematicSvg: string
): true {
  if (
    !hasExactKeys(value, [
      "artifactKind",
      "authority",
      "canonicalNetDigestSha256",
      "erc",
      "scope",
      "source",
      "schematicSvg"
    ]) ||
    !hasExactKeys(value.authority, [
      "bp300SchematicSource",
      "ercReport",
      "fabrication",
      "physicalEvidence",
      "schematicIntegrationAuthorized"
    ]) ||
    !hasExactKeys(value.erc, ["componentErrorCount", "errorElementTypes", "portErrorCount", "totalErrorCount"]) ||
    !hasExactKeys(value.source, ["path", "sha256"]) ||
    !hasExactKeys(value.schematicSvg, ["path", "sha256"])
  ) {
    throw new RangeError("BP-123 fragment ERC report must contain exactly the fail-closed review-artifact keys")
  }
  if (
    value.artifactKind !== "bp-123-reset-watchdog-fragment-render-erc-report" ||
    value.scope !== "rendered-review-fragment-only" ||
    value.canonicalNetDigestSha256 !== bp123ResetWatchdogGeometryNetDigest ||
    value.source.path !== bp123ResetWatchdogFragmentArtifactPaths.source ||
    value.source.sha256 !== sourceSha256 ||
    value.schematicSvg.path !== bp123ResetWatchdogFragmentArtifactPaths.schematicSvg ||
    value.schematicSvg.sha256 !== sha256(schematicSvg) ||
    !isSha256(sourceSha256) ||
    !isSha256(value.source.sha256) ||
    !isSha256(value.schematicSvg.sha256) ||
    value.authority.bp300SchematicSource !== false ||
    value.authority.ercReport !== false ||
    value.authority.fabrication !== false ||
    value.authority.physicalEvidence !== false ||
    value.authority.schematicIntegrationAuthorized !== false ||
    value.erc.componentErrorCount !== 0 ||
    value.erc.portErrorCount !== 0 ||
    value.erc.totalErrorCount !== 0 ||
    !Array.isArray(value.erc.errorElementTypes) ||
    value.erc.errorElementTypes.length !== 0
  ) {
    throw new RangeError("BP-123 fragment ERC report must retain zero render errors and all authority denied")
  }
  return true
}
