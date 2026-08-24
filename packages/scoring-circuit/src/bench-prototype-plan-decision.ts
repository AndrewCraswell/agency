/**
 * BP-000: the reviewed ownership and decision record for the bench prototype.
 *
 * This artifact assigns every work unit in the canonical bench-prototype plan
 * to one lane owner. The root task is the final reviewer for every lane and
 * work unit; an implementation agent cannot approve or close its own work.
 */

export const benchPrototypePlanTaskIds = [
  "BP-000",
  "BP-010",
  "BP-020",
  "BP-030",
  "BP-031",
  "BP-032",
  "BP-033",
  "BP-034",
  "BP-035",
  "BP-040",
  "BP-050",
  "BP-100",
  "BP-101",
  "BP-102",
  "BP-103",
  "BP-104",
  "BP-105",
  "BP-106",
  "BP-120",
  "BP-121",
  "BP-122",
  "BP-123",
  "BP-124",
  "BP-125",
  "BP-126",
  "BP-140",
  "BP-141",
  "BP-142",
  "BP-143",
  "BP-144",
  "BP-145",
  "BP-146",
  "BP-300",
  "BP-301",
  "BP-302",
  "BP-303",
  "BP-400",
  "BP-401",
  "BP-402",
  "BP-403",
  "BP-500",
  "BP-501",
  "BP-502",
  "BP-503",
  "BP-504",
  "BP-505",
  "BP-506",
  "BP-507",
  "BP-508",
  "BP-509",
  "BP-510",
  "BP-511"
] as const

export type BenchPrototypeTaskId = (typeof benchPrototypePlanTaskIds)[number]
export type BenchPrototypeLaneId = "A" | "B" | "C" | "D" | "E" | "F"

export const rootFinalReviewerRole = "root-final-reviewer" as const

type BenchPrototypeLaneDefinition = {
  readonly id: BenchPrototypeLaneId
  readonly name: string
  readonly owner: string
  readonly reviewer: typeof rootFinalReviewerRole
}

const laneDefinitions = [
  {
    id: "A",
    name: "architecture and schematic control",
    owner: "architecture-and-schematic-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "B",
    name: "analog and weapon fixture",
    owner: "analog-and-weapon-fixture-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "C",
    name: "processors and isolation",
    owner: "processors-and-isolation-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "D",
    name: "Ethernet, display, and application I/O",
    owner: "ethernet-display-and-application-io-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "E",
    name: "physical bench design",
    owner: "physical-bench-design-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "F",
    name: "firmware and test assets",
    owner: "firmware-and-test-assets-owner",
    reviewer: rootFinalReviewerRole
  }
] as const satisfies readonly BenchPrototypeLaneDefinition[]

const taskAssignments = [
  ["BP-000", "A"],
  ["BP-010", "E"],
  ["BP-020", "A"],
  ["BP-030", "A"],
  ["BP-031", "B"],
  ["BP-032", "C"],
  ["BP-033", "D"],
  ["BP-034", "B"],
  ["BP-035", "A"],
  ["BP-040", "A"],
  ["BP-050", "A"],
  ["BP-100", "B"],
  ["BP-101", "B"],
  ["BP-102", "B"],
  ["BP-103", "B"],
  ["BP-104", "B"],
  ["BP-105", "B"],
  ["BP-106", "B"],
  ["BP-120", "C"],
  ["BP-121", "C"],
  ["BP-122", "C"],
  ["BP-123", "C"],
  ["BP-124", "C"],
  ["BP-125", "C"],
  ["BP-126", "C"],
  ["BP-140", "D"],
  ["BP-141", "D"],
  ["BP-142", "D"],
  ["BP-143", "D"],
  ["BP-144", "D"],
  ["BP-145", "D"],
  ["BP-146", "D"],
  ["BP-300", "A"],
  ["BP-301", "A"],
  ["BP-302", "E"],
  ["BP-303", "A"],
  ["BP-400", "E"],
  ["BP-401", "E"],
  ["BP-402", "E"],
  ["BP-403", "A"],
  ["BP-500", "C"],
  ["BP-501", "F"],
  ["BP-502", "E"],
  ["BP-503", "F"],
  ["BP-504", "F"],
  ["BP-505", "C"],
  ["BP-506", "D"],
  ["BP-507", "D"],
  ["BP-508", "B"],
  ["BP-509", "F"],
  ["BP-510", "F"],
  ["BP-511", "F"]
] as const satisfies readonly (readonly [BenchPrototypeTaskId, BenchPrototypeLaneId])[]

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value
  if (seen.has(value)) throw new RangeError("BP-000 decision artifact cannot contain cycles or aliases")
  seen.add(value)
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError("BP-000 decision artifact may contain only data properties")
    }
    deepFreeze(descriptor.value, seen)
  }
  Object.freeze(value)
  return value
}

function findLane(laneId: BenchPrototypeLaneId): BenchPrototypeLaneDefinition {
  const lane = laneDefinitions.find((candidate) => candidate.id === laneId)
  if (lane === undefined) throw new RangeError(`BP-000 has no definition for lane ${laneId}`)
  return lane
}

const assignments = taskAssignments.map(([taskId, laneId]) => {
  const lane = findLane(laneId)
  return {
    taskId,
    lane: laneId,
    owner: lane.owner,
    reviewer: lane.reviewer
  }
})

const benchPrototypePlanDecisionDefinition = {
  artifactKind: "bench-prototype-plan-decision",
  workUnit: "BP-000",
  canonicalPlan: "packages/scoring-circuit/docs/bench-prototype-plan.md",
  revision: "BP-000.1",
  decision: "approved-plan-revision",
  approval: {
    preparedBy: "implementation-agent",
    finalReviewer: rootFinalReviewerRole,
    reviewedAtUtc: "2026-08-24T00:00:00.000Z",
    state: "approved"
  },
  lanes: laneDefinitions,
  assignments
} as const

export const benchPrototypePlanDecision = deepFreeze(benchPrototypePlanDecisionDefinition)

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function requireExactKeys(value: Record<string, unknown>, expected: readonly string[], context: string): void {
  const actual = Reflect.ownKeys(value)
  if (
    actual.length !== expected.length ||
    actual.some((key) => typeof key !== "string" || !expected.includes(key)) ||
    expected.some((key) => !Object.hasOwn(value, key))
  ) {
    throw new RangeError(`${context} has unexpected or missing fields`)
  }
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new RangeError(`${context}.${key} must be a data property`)
    }
  }
}

function requireNonEmptyString(value: unknown, context: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new RangeError(`${context} must be a non-empty string`)
}

/**
 * Validates BP-000 and fails closed when the canonical plan gains an
 * unassigned task, a duplicate/extra assignment, or a self-review assignment.
 */
export function validateBenchPrototypePlanDecision(input: unknown): true {
  if (!isRecordObject(input)) throw new RangeError("BP-000 decision artifact must be a plain object")
  requireExactKeys(
    input,
    ["artifactKind", "workUnit", "canonicalPlan", "revision", "decision", "approval", "lanes", "assignments"],
    "BP-000 decision artifact"
  )
  if (
    input.artifactKind !== "bench-prototype-plan-decision" ||
    input.workUnit !== "BP-000" ||
    input.canonicalPlan !== "packages/scoring-circuit/docs/bench-prototype-plan.md" ||
    input.revision !== "BP-000.1" ||
    input.decision !== "approved-plan-revision"
  ) {
    throw new RangeError("BP-000 decision metadata drifted")
  }

  if (!isRecordObject(input.approval)) throw new RangeError("BP-000 approval record must be a plain object")
  requireExactKeys(input.approval, ["preparedBy", "finalReviewer", "reviewedAtUtc", "state"], "BP-000 approval record")
  if (input.approval.preparedBy !== "implementation-agent") {
    throw new RangeError("BP-000 approval record must identify the implementation role")
  }
  if (
    input.approval.finalReviewer !== rootFinalReviewerRole ||
    input.approval.reviewedAtUtc !== "2026-08-24T00:00:00.000Z" ||
    input.approval.state !== "approved"
  ) {
    throw new RangeError("BP-000 must record final approval by root-final-reviewer")
  }

  if (!Array.isArray(input.lanes) || input.lanes.length !== laneDefinitions.length) {
    throw new RangeError("BP-000 must define every bench-prototype lane exactly once")
  }
  const seenLanes = new Set<string>()
  for (const [index, candidate] of input.lanes.entries()) {
    if (!isRecordObject(candidate)) throw new RangeError(`BP-000 lane ${index + 1} must be a plain object`)
    requireExactKeys(candidate, ["id", "name", "owner", "reviewer"], `BP-000 lane ${index + 1}`)
    const expected = laneDefinitions[index]
    if (expected === undefined || candidate.id !== expected.id || seenLanes.has(String(candidate.id))) {
      throw new RangeError("BP-000 lane order or identity drifted")
    }
    seenLanes.add(String(candidate.id))
    if (
      candidate.name !== expected.name ||
      candidate.owner !== expected.owner ||
      candidate.reviewer !== rootFinalReviewerRole
    ) {
      throw new RangeError(`BP-000 lane ${candidate.id} has incomplete role assignment`)
    }
    if (candidate.owner === candidate.reviewer) throw new RangeError(`BP-000 lane ${candidate.id} self-reviews`)
  }

  if (!Array.isArray(input.assignments) || input.assignments.length !== benchPrototypePlanTaskIds.length) {
    throw new RangeError("BP-000 must assign every canonical bench-prototype task exactly once")
  }
  const expectedTaskIds = new Set<string>(benchPrototypePlanTaskIds)
  const seenTaskIds = new Set<string>()
  for (const [index, candidate] of input.assignments.entries()) {
    if (!isRecordObject(candidate)) throw new RangeError(`BP-000 assignment ${index + 1} must be a plain object`)
    requireExactKeys(candidate, ["taskId", "lane", "owner", "reviewer"], `BP-000 assignment ${index + 1}`)
    requireNonEmptyString(candidate.taskId, `BP-000 assignment ${index + 1} taskId`)
    requireNonEmptyString(candidate.owner, `BP-000 assignment ${candidate.taskId} owner`)
    requireNonEmptyString(candidate.reviewer, `BP-000 assignment ${candidate.taskId} reviewer`)
    if (!expectedTaskIds.has(candidate.taskId) || seenTaskIds.has(candidate.taskId)) {
      throw new RangeError(`BP-000 assignment ${candidate.taskId} is missing, duplicated, or extra`)
    }
    seenTaskIds.add(candidate.taskId)
    if (candidate.reviewer !== rootFinalReviewerRole) {
      throw new RangeError(`BP-000 assignment ${candidate.taskId} does not reserve review for root-final-reviewer`)
    }
    if (candidate.owner === candidate.reviewer) {
      throw new RangeError(`BP-000 assignment ${candidate.taskId} assigns the owner as reviewer`)
    }
    if (typeof candidate.lane !== "string") throw new RangeError(`BP-000 assignment ${candidate.taskId} has no lane`)
    const lane = laneDefinitions.find((definition) => definition.id === candidate.lane)
    if (lane === undefined || candidate.owner !== lane.owner) {
      throw new RangeError(`BP-000 assignment ${candidate.taskId} has no valid lane owner`)
    }
  }
  if (seenTaskIds.size !== expectedTaskIds.size) throw new RangeError("BP-000 has an unassigned canonical task")
  return true
}

validateBenchPrototypePlanDecision(benchPrototypePlanDecision)
