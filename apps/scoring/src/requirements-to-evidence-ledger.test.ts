import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  deriveRequirementEvidenceState,
  requirementsToEvidenceLedger,
  validateRequirementsToEvidenceLedger
} from "./requirements-to-evidence-ledger.js"

function replaceDataProperty(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { configurable: true, enumerable: true, value, writable: true })
}

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url))

const sourceRules = {
  "bench-plan": { columns: [0, 3, 4, 5], id: /^BP-\d+$/ },
  "c17-migration": { columns: [0, 3, 4, 5], id: /^CW-\d+[A-Z]?$/ },
  "device-plan": { columns: [0, 3, 4, 5], id: /^(?:M\d+-\d+|BT-\d+)$/ },
  "encrypted-ir": { columns: [0, 3, 4, 5], id: /^RC-\d+$/ },
  fie: { columns: undefined, id: /^(?:GEN|FOIL|EPEE|SABRE|OUT|PWR|CLOCK|INT)-\d+$/ }
} as const

function normalizeCell(value: string): string {
  return value.replaceAll(/[`*]/g, "").replaceAll(/\s+/g, " ").trim()
}

function extractRequirementProjection(sourceId: keyof typeof sourceRules, markdown: string): string[][] {
  const rule = sourceRules[sourceId]
  return markdown
    .split(/\r?\n/)
    .filter((line) => line.startsWith("|"))
    .map((line) => line.slice(1, -1).split("|").map(normalizeCell))
    .filter((cells) => rule.id.test(cells[0] ?? ""))
    .map((cells) => (rule.columns === undefined ? cells : rule.columns.map((column) => cells[column] ?? "")))
    .toSorted(([left], [right]) => (left ?? "").localeCompare(right ?? ""))
}

function digestProjection(projection: readonly string[][]): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(projection)).digest("hex")}`
}

describe("M0-12 requirements-to-evidence ledger", () => {
  it("maps each canonical requirement family to independently owned evidence stages", () => {
    expect(validateRequirementsToEvidenceLedger(requirementsToEvidenceLedger)).toBe(true)
    expect(requirementsToEvidenceLedger.releaseState).toBe("deny")
    expect(requirementsToEvidenceLedger.rows).toHaveLength(19)
    for (const row of requirementsToEvidenceLedger.rows) {
      expect(Object.keys(row.evidenceOwners)).toEqual(["unit", "simulator", "nativeC", "wasm", "hil", "physical"])
      expect(deriveRequirementEvidenceState(row)).toBe("blocked")
    }
  })

  it("binds every authoritative requirement ID and requirement-text projection exactly once", () => {
    const routedKeys = new Set<string>()
    for (const source of requirementsToEvidenceLedger.sourceBindings) {
      const markdown = readFileSync(`${repositoryRoot}/${source.path}`, "utf8")
      const projection = extractRequirementProjection(source.sourceId, markdown)
      const extractedIds = projection.map(([id]) => id ?? "")
      const routedIds = source.routes.flatMap((route) => route.ids)

      expect(extractedIds).toEqual(routedIds.toSorted())
      expect(new Set(extractedIds).size).toBe(extractedIds.length)
      expect(new Set(routedIds).size).toBe(routedIds.length)
      expect(digestProjection(projection)).toBe(source.requirementProjectionSha256)

      for (const id of routedIds) {
        const key = `${source.sourceId}:${id}`
        expect(routedKeys.has(key)).toBe(false)
        routedKeys.add(key)
      }
    }
  })

  it("keeps normative, hardware, security, and encrypted remote requirements explicitly represented", () => {
    expect(requirementsToEvidenceLedger.rows.map((row) => row.kind)).toEqual(
      expect.arrayContaining(["normative", "hardware", "security", "product"])
    )
    expect(
      requirementsToEvidenceLedger.rows.find((row) => row.stableId === "REQ-NORM-THREE-WEAPON")?.requirementIds
    ).toContain("SABRE-07")
    expect(
      requirementsToEvidenceLedger.rows.find((row) => row.stableId === "REQ-SECURITY-TRUST")?.requirementIds
    ).toEqual(["M0-11"])
    expect(
      requirementsToEvidenceLedger.rows.find((row) => row.stableId === "REQ-PRODUCT-ENCRYPTED-IR")?.requirementIds
    ).toContain("RC-18")
  })

  it("rejects missing requirements, evidence approval claims, aliasing, and accessor data", () => {
    const missingRow = structuredClone(requirementsToEvidenceLedger)
    Reflect.deleteProperty(missingRow.rows, `${requirementsToEvidenceLedger.rows.length - 1}`)
    expect(() => validateRequirementsToEvidenceLedger(missingRow)).toThrow(RangeError)

    const approvedEvidence = structuredClone(requirementsToEvidenceLedger)
    replaceDataProperty(approvedEvidence.rows[0].evidenceOwners.unit, "state", "approved")
    expect(() => validateRequirementsToEvidenceLedger(approvedEvidence)).toThrow(RangeError)

    const staleSource = structuredClone(requirementsToEvidenceLedger)
    replaceDataProperty(staleSource.sourceBindings[0], "requirementProjectionSha256", `sha256:${"0".repeat(64)}`)
    expect(() => validateRequirementsToEvidenceLedger(staleSource)).toThrow(RangeError)

    const alias = structuredClone(requirementsToEvidenceLedger)
    replaceDataProperty(alias.rows[1], "evidenceOwners", alias.rows[0].evidenceOwners)
    expect(() => validateRequirementsToEvidenceLedger(alias)).toThrow(RangeError)

    const accessor = structuredClone(requirementsToEvidenceLedger)
    Object.defineProperty(accessor, "releaseState", { enumerable: true, get: () => "deny" })
    expect(() => validateRequirementsToEvidenceLedger(accessor)).toThrow(RangeError)
  })
})
