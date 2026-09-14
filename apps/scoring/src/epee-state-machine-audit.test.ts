import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  loadM101EpeeStateMachineAudit,
  M101_EPEE_AUDIT_BRANCHES,
  M101_EPEE_SOURCE_CONTRACTS,
  M101_EPEE_STATE_MACHINE_AUDIT,
  validateM101EpeeStateMachineAudit
} from "./epee-state-machine-audit.js"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

function canonicalSourceDigest(source: Buffer | string): string {
  return createHash("sha256").update(source.toString().replace(/\r\n/gu, "\n")).digest("hex")
}

function editableAudit() {
  return {
    authority: { c17MigrationRequired: true, scoringAuthority: false, typescriptOracleOnly: true },
    branches: M101_EPEE_AUDIT_BRANCHES.map(({ id, implementation, requirement, sourceContractPath, state }) => ({
      id: String(id),
      implementation: String(implementation),
      requirement,
      sourceContractPath: String(sourceContractPath),
      state
    })),
    sourceContracts: M101_EPEE_SOURCE_CONTRACTS.map(({ commit, sha256, sourcePath }) => ({
      commit: String(commit),
      sha256: String(sha256),
      sourcePath: String(sourcePath)
    })),
    version: "M1-01.epee-state-machine-1"
  }
}

describe("M1-01 epee state-machine audit", () => {
  it("maps every current boolean and resistance branch to a cited requirement without treating output work as scorer behavior", () => {
    expect(M101_EPEE_AUDIT_BRANCHES.map(({ id }) => id)).toEqual([
      "boolean-invalid-or-grounded-clears-candidate",
      "boolean-closed-ungrounded-starts-candidate",
      "boolean-duration-below-two-ms-remains-pending",
      "boolean-duration-at-two-ms-registers-once",
      "boolean-first-hit-and-double-window",
      "boolean-pending-candidate-delays-lock",
      "boolean-locked-state-is-inert",
      "boolean-input-and-record-order",
      "resistance-known-10-or-100-ohm-only",
      "resistance-fault-and-ground-diagnostics",
      "outputs-are-not-decided-by-the-scorer"
    ])
    expect(M101_EPEE_AUDIT_BRANCHES.filter(({ state }) => state === "deferred")).toEqual([
      expect.objectContaining({ id: "outputs-are-not-decided-by-the-scorer", requirement: "EPEE-05" })
    ])
    expect(
      M101_EPEE_AUDIT_BRANCHES.every(({ requirement }) => requirement.startsWith("EPEE-") || requirement === "GEN-03")
    ).toBe(true)
  })

  it("pins each audited source and direct boundary suite to its declared committed blob and current content", () => {
    for (const contract of M101_EPEE_SOURCE_CONTRACTS) {
      const currentSource = readFileSync(resolve(repositoryRoot, contract.sourcePath), "utf8")
      const committedSource = execFileSync("git", ["show", `${contract.commit}:${contract.sourcePath}`], {
        cwd: repositoryRoot
      })

      expect(canonicalSourceDigest(currentSource)).toBe(contract.sha256)
      expect(canonicalSourceDigest(committedSource)).toBe(contract.sha256)
      expect(contract.commit).toMatch(/^[0-9a-f]{40}$/u)
    }
  })

  it("fails closed for changed branch, source, authority, and version evidence", () => {
    expect(validateM101EpeeStateMachineAudit(M101_EPEE_STATE_MACHINE_AUDIT)).toBe(true)

    const changedBranch = editableAudit()
    changedBranch.branches[0]!.state = "deferred"
    expect(() => validateM101EpeeStateMachineAudit(changedBranch)).toThrow("branch evidence drifted")

    const duplicateBranch = editableAudit()
    duplicateBranch.branches[1]!.id = duplicateBranch.branches[0]!.id
    expect(() => validateM101EpeeStateMachineAudit(duplicateBranch)).toThrow("duplicate branch identifiers")

    const changedSource = editableAudit()
    changedSource.sourceContracts[0]!.sha256 = "0".repeat(64)
    expect(() => validateM101EpeeStateMachineAudit(changedSource)).toThrow("source-contract evidence drifted")

    const changedAuthority = editableAudit()
    changedAuthority.authority.typescriptOracleOnly = false
    expect(() => validateM101EpeeStateMachineAudit(changedAuthority)).toThrow(
      "immutable no-authority C17 migration boundary"
    )

    expect(() => validateM101EpeeStateMachineAudit({ branches: [], sourceContracts: [] })).toThrow(
      "immutable no-authority C17 migration boundary"
    )
  })

  it("returns immutable audit evidence only, never a TypeScript scoring authority", () => {
    const audit = loadM101EpeeStateMachineAudit()

    expect(audit.authority).toEqual({ c17MigrationRequired: true, scoringAuthority: false, typescriptOracleOnly: true })
    expect(Object.isFrozen(audit)).toBe(true)
    expect(Object.isFrozen(audit.branches)).toBe(true)
    expect(Object.isFrozen(audit.sourceContracts)).toBe(true)
  })
})

it("rejects malformed audit containers and unversioned evidence", () => {
  expect(() => validateM101EpeeStateMachineAudit(null)).toThrow(TypeError)
  expect(() => validateM101EpeeStateMachineAudit({ ...M101_EPEE_STATE_MACHINE_AUDIT, branches: [null] })).toThrow(
    RangeError
  )
  expect(() => validateM101EpeeStateMachineAudit({ ...M101_EPEE_STATE_MACHINE_AUDIT, sourceContracts: [] })).toThrow(
    RangeError
  )
})

it("validates missing audit versions and milestone evidence", () => {
  expect(() => validateM101EpeeStateMachineAudit({ ...M101_EPEE_STATE_MACHINE_AUDIT, version: "unknown" })).toThrow(
    RangeError
  )
})
