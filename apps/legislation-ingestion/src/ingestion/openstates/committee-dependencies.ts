import type { inventoryCommitteeHistory } from "./committee-history.js"

type CommitteeInventory = ReturnType<typeof inventoryCommitteeHistory>

/** A held committee keeps its whole source roster. Never publish the remaining members as a complete roster. */
export function planCommitteeDependencies(inventory: CommitteeInventory, acceptedSourcePersonIds: readonly string[]) {
  const rosters = planDependencies(inventory, new Set(acceptedSourcePersonIds))
  const identities = planDependencies(inventory)
  return { ...rosters, identityEligible: identities.eligible, identityHeld: identities.held }
}

// Organization identity does not depend on membership acceptance. Structural parent/chamber checks always apply.
function planDependencies(inventory: CommitteeInventory, accepted?: ReadonlySet<string>) {
  const committees = new Map(inventory.observations.map((committee) => [committee.committeeId, committee]))
  const reasons = new Map<string, Set<string>>()
  for (const committee of inventory.observations) {
    const issues = new Set<string>()
    if (committee.chamber === null) {
      issues.add("unknown_chamber")
    }
    if (accepted && committee.members.some((member) => member.personId === null || !accepted.has(member.personId))) {
      issues.add("unaccepted_person")
    }
    const visited = new Set([committee.committeeId])
    let parent = committee.parentSourceId
    while (parent !== null) {
      if (visited.has(parent)) {
        issues.add("parent_cycle")
        break
      }
      visited.add(parent)
      const ancestor = committees.get(parent)
      if (!ancestor) {
        issues.add("missing_parent")
        break
      }
      parent = ancestor.parentSourceId
    }
    reasons.set(committee.committeeId, issues)
  }
  // Propagate holds without depending on input order.
  for (let pass = 0; pass < committees.size; pass += 1) {
    let changed = false
    for (const committee of inventory.observations) {
      const issues = reasons.get(committee.committeeId)!
      if (
        committee.parentSourceId !== null &&
        (reasons.get(committee.parentSourceId)?.size ?? 0) > 0 &&
        !issues.has("held_parent")
      ) {
        issues.add("held_parent")
        changed = true
      }
    }
    if (!changed) {
      break
    }
  }
  const ordered = [...inventory.observations].sort((a, b) => a.committeeId.localeCompare(b.committeeId))
  const eligible = ordered.filter((committee) => reasons.get(committee.committeeId)!.size === 0)
  const held = ordered
    .filter((committee) => reasons.get(committee.committeeId)!.size > 0)
    .map((committee) => ({ ...committee, reasons: [...reasons.get(committee.committeeId)!].sort() }))
  return {
    eligible,
    held,
    eligibleMemberships: eligible.reduce((sum, committee) => sum + committee.members.length, 0),
    heldMemberships: held.reduce((sum, committee) => sum + committee.members.length, 0),
    // Dependency eligibility alone does not authorize replacement or establish history completeness.
    canonicalWrites: false as const,
    departuresEstablished: false as const,
    completenessEstablished: false as const
  }
}
