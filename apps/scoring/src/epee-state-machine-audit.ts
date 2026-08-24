/**
 * Executable M1-01 inventory of the current TypeScript epee oracle.
 *
 * This is evidence about the temporary simulator oracle only. It grants no
 * scoring authority and must migrate into the C17 core without a TypeScript
 * scoring fallback.
 */

export type M101SourceContract = {
  readonly commit: string
  readonly sha256: string
  readonly sourcePath: string
}

export type M101AuditBranch = {
  readonly id: string
  readonly implementation: string
  readonly requirement: "EPEE-01" | "EPEE-02" | "EPEE-03" | "EPEE-04" | "EPEE-05" | "GEN-03"
  readonly sourceContractPath: string
  readonly state: "deferred" | "retained"
}

export type M101EpeeStateMachineAudit = {
  readonly authority: {
    readonly c17MigrationRequired: true
    readonly scoringAuthority: false
    readonly typescriptOracleOnly: true
  }
  readonly branches: readonly M101AuditBranch[]
  readonly sourceContracts: readonly M101SourceContract[]
  readonly version: "M1-01.epee-state-machine-1"
}

function deepFreeze<const Value>(value: Value): Value {
  if (value !== null && typeof value === "object") {
    for (const nestedValue of Object.values(value)) deepFreeze(nestedValue)
    Object.freeze(value)
  }

  return value
}

export const M101_EPEE_SOURCE_CONTRACTS = deepFreeze([
  {
    commit: "3609d483e290d8ab8de6967c9b3d5c9fe2ec3ad9",
    sha256: "428d020fd742bbed2de06b2dbef9722e807959bd9ef4c7e786c1593cb9269677",
    sourcePath: "apps/scoring/src/epee.ts"
  },
  {
    commit: "3609d483e290d8ab8de6967c9b3d5c9fe2ec3ad9",
    sha256: "c347542b3875c704340b174a2475dc1203e0b72c8c2cea650cc09b64c1a10584",
    sourcePath: "apps/scoring/src/epee-resistance.ts"
  },
  {
    commit: "3609d483e290d8ab8de6967c9b3d5c9fe2ec3ad9",
    sha256: "32778e202477deacf62318fb06bf0c0c5dd8d2a04a286afa14acc897e7da9108",
    sourcePath: "apps/scoring/src/epee.test.ts"
  },
  {
    commit: "3609d483e290d8ab8de6967c9b3d5c9fe2ec3ad9",
    sha256: "23022234a4ac44ef4f758f797d5abae77c8e2b4577e9805d8c82f1b2f0eedc70",
    sourcePath: "apps/scoring/src/epee-resistance.test.ts"
  }
] as const satisfies readonly M101SourceContract[])

export const M101_EPEE_AUDIT_BRANCHES = deepFreeze([
  {
    id: "boolean-invalid-or-grounded-clears-candidate",
    implementation: "advanceContact rejects open or grounded boolean samples before duration qualification.",
    requirement: "EPEE-04",
    sourceContractPath: "apps/scoring/src/epee.ts",
    state: "retained"
  },
  {
    id: "boolean-closed-ungrounded-starts-candidate",
    implementation: "advanceContact records the observed start for one side-local confirmed closed loop.",
    requirement: "EPEE-01",
    sourceContractPath: "apps/scoring/src/epee.ts",
    state: "retained"
  },
  {
    id: "boolean-duration-below-two-ms-remains-pending",
    implementation:
      "advanceContact retains a trusted candidate while elapsed microseconds are below timing-1's 2,000 us floor.",
    requirement: "EPEE-03",
    sourceContractPath: "apps/scoring/src/epee.ts",
    state: "retained"
  },
  {
    id: "boolean-duration-at-two-ms-registers-once",
    implementation:
      "advanceContact registers at the inclusive 2,000 us floor and prevents a second hit from that side.",
    requirement: "EPEE-03",
    sourceContractPath: "apps/scoring/src/epee.ts",
    state: "retained"
  },
  {
    id: "boolean-first-hit-and-double-window",
    implementation:
      "advanceEpeeScoring retains a second candidate only when its observed start is within timing-1's inclusive 45,000 us product window.",
    requirement: "EPEE-02",
    sourceContractPath: "apps/scoring/src/epee.ts",
    state: "retained"
  },
  {
    id: "boolean-pending-candidate-delays-lock",
    implementation:
      "advanceEpeeScoring waits for a candidate that started inside the product window, then locks after it resolves.",
    requirement: "EPEE-02",
    sourceContractPath: "apps/scoring/src/epee.ts",
    state: "retained"
  },
  {
    id: "boolean-locked-state-is-inert",
    implementation:
      "advanceEpeeScoring preserves registered hits after lockout while advancing only the monotonic sample timestamp.",
    requirement: "EPEE-02",
    sourceContractPath: "apps/scoring/src/epee.ts",
    state: "retained"
  },
  {
    id: "boolean-input-and-record-order",
    implementation:
      "advanceEpeeScoring rejects invalid or backward timestamps, accepts equal captures, and orders simultaneous records by observed start then side.",
    requirement: "EPEE-01",
    sourceContractPath: "apps/scoring/src/epee.ts",
    state: "retained"
  },
  {
    id: "resistance-known-10-or-100-ohm-only",
    implementation:
      "epee-resistance accepts only exact measured 10 ohm and 100 ohm points; uncertain and unavailable measurements fail closed.",
    requirement: "EPEE-03",
    sourceContractPath: "apps/scoring/src/epee-resistance.ts",
    state: "retained"
  },
  {
    id: "resistance-fault-and-ground-diagnostics",
    implementation:
      "epee-resistance rejects grounded material and reports line, ground, loop, and measurement uncertainty without converting them to hits.",
    requirement: "GEN-03",
    sourceContractPath: "apps/scoring/src/epee-resistance.ts",
    state: "retained"
  },
  {
    id: "outputs-are-not-decided-by-the-scorer",
    implementation:
      "Neither current epee scorer controls lamps or audio; visual independence and sound remain separate output evidence.",
    requirement: "EPEE-05",
    sourceContractPath: "apps/scoring/src/epee.ts",
    state: "deferred"
  }
] as const satisfies readonly M101AuditBranch[])

export const M101_EPEE_STATE_MACHINE_AUDIT = deepFreeze({
  authority: { c17MigrationRequired: true, scoringAuthority: false, typescriptOracleOnly: true },
  branches: M101_EPEE_AUDIT_BRANCHES,
  sourceContracts: M101_EPEE_SOURCE_CONTRACTS,
  version: "M1-01.epee-state-machine-1"
} as const satisfies M101EpeeStateMachineAudit)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Rejects changed, missing, duplicate, or uncited M1-01 branch evidence. */
export function validateM101EpeeStateMachineAudit(value: unknown): true {
  if (!isRecord(value) || !Array.isArray(value.branches) || !Array.isArray(value.sourceContracts)) {
    throw new TypeError("M1-01 epee audit must contain branch and source-contract arrays")
  }

  if (JSON.stringify(value.authority) !== JSON.stringify(M101_EPEE_STATE_MACHINE_AUDIT.authority)) {
    throw new RangeError("M1-01 epee audit authority must remain the immutable no-authority C17 migration boundary")
  }

  const branchIds = value.branches.map((branch) => (isRecord(branch) ? branch.id : undefined))
  if (new Set(branchIds).size !== branchIds.length || branchIds.some((id) => typeof id !== "string")) {
    throw new RangeError("M1-01 epee audit has missing or duplicate branch identifiers")
  }

  if (JSON.stringify(value.branches) !== JSON.stringify(M101_EPEE_AUDIT_BRANCHES)) {
    throw new RangeError("M1-01 epee audit branch evidence drifted")
  }
  if (JSON.stringify(value.sourceContracts) !== JSON.stringify(M101_EPEE_SOURCE_CONTRACTS)) {
    throw new RangeError("M1-01 epee audit source-contract evidence drifted")
  }
  if (value.version !== M101_EPEE_STATE_MACHINE_AUDIT.version) {
    throw new RangeError("M1-01 epee audit has an unknown version")
  }

  return true
}

/** Loads only the immutable M1-01 evidence inventory, never a scorer. */
export function loadM101EpeeStateMachineAudit(): typeof M101_EPEE_STATE_MACHINE_AUDIT {
  validateM101EpeeStateMachineAudit(M101_EPEE_STATE_MACHINE_AUDIT)
  return M101_EPEE_STATE_MACHINE_AUDIT
}
