/**
 * BP-000: the reviewed ownership and decision record for the bench prototype.
 *
 * This artifact assigns every work unit in the canonical bench-prototype plan
 * to one lane owner. The root task is the final reviewer for every lane and
 * work unit; an implementation agent cannot approve or close its own work.
 */

export const benchPrototypePlanTaskIds = [
  "BP-000",
  "BP-020",
  "BP-040",
  "BP-050",
  "BP-100",
  "BP-104",
  "BP-108",
  "BP-120",
  "BP-126",
  "BP-140",
  "BP-143",
  "BP-320",
  "BP-321",
  "BP-323",
  "BP-328",
  "BP-333",
  "BP-420",
  "BP-426",
  "BP-427",
  "BP-430",
  "BP-432",
  "BP-434",
  "BP-521",
  "BP-522",
  "BP-524",
  "BP-526",
  "BP-532",
  "BP-623",
  "BP-625",
  "BP-628",
  "BP-631",
  "BP-633"
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
    name: "architecture, power contracts, and schematic control",
    owner: "architecture-and-schematic-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "B",
    name: "analog, weapon interface, and fixture",
    owner: "analog-and-weapon-fixture-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "C",
    name: "ESP32, acquisition, reset, and recovery",
    owner: "esp32-acquisition-and-recovery-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "D",
    name: "Ethernet, display, encrypted IR, and outputs",
    owner: "ethernet-display-and-application-io-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "E",
    name: "physical board implementation",
    owner: "physical-bench-design-owner",
    reviewer: rootFinalReviewerRole
  },
  {
    id: "F",
    name: "firmware, fixture software, and physical evidence",
    owner: "firmware-and-test-assets-owner",
    reviewer: rootFinalReviewerRole
  }
] as const satisfies readonly BenchPrototypeLaneDefinition[]

function laneForTask(taskId: BenchPrototypeTaskId): BenchPrototypeLaneId {
  const numericId = Number.parseInt(taskId.slice(3), 10)
  if (numericId >= 420 && numericId <= 435) return "E"
  if (numericId >= 100 && numericId <= 111) return "B"
  if (numericId >= 120 && numericId <= 128) return "C"
  if (numericId >= 140 && numericId <= 149) return "D"
  if ((numericId >= 520 && numericId <= 533) || (numericId >= 620 && numericId <= 633)) return "F"
  return "A"
}

const taskAssignments: readonly (readonly [BenchPrototypeTaskId, BenchPrototypeLaneId])[] =
  benchPrototypePlanTaskIds.map((taskId) => [taskId, laneForTask(taskId)] as const)

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
  canonicalPlan: "packages/scoring-circuit/docs/esp32-prototype-backlog.md",
  revision: "BP-000.3",
  decision: "approved-plan-revision",
  approval: {
    preparedBy: "implementation-agent",
    finalReviewer: rootFinalReviewerRole,
    reviewedAtUtc: "2026-08-25T21:55:53.000Z",
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
    input.canonicalPlan !== "packages/scoring-circuit/docs/esp32-prototype-backlog.md" ||
    input.revision !== "BP-000.3" ||
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
    input.approval.reviewedAtUtc !== "2026-08-25T21:55:53.000Z" ||
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
