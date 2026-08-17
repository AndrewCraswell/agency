import { describe, expect, it } from "vitest"
import { validateOperationalEvidence } from "./operational-evidence.js"

const digest = (character: string) => `registry.example/legislation@sha256:${character.repeat(64)}`
const resourceId = (name: string) =>
  `/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/legislation-stg/providers/Microsoft.Insights/${name}`

function evidence() {
  return {
    alerts: [
      "document-failure-rate",
      "embedding-backlog",
      "infrastructure-health",
      "mcp-failures",
      "readiness-failure",
      "scheduled-sync-failure",
      "stalled-checkpoint"
    ].map((name) => ({
      actionGroupIds: [resourceId("actionGroups/on-call")],
      firedAt: "2026-08-17T01:00:00.000Z",
      name,
      recoveryEvidence: `alerts/${name}.json`,
      resolvedAt: "2026-08-17T01:15:00.000Z",
      ruleId: resourceId(`scheduledQueryRules/${name}`),
      state: "resolved"
    })),
    databaseRestore: {
      activeTargetFingerprint: "sha256:active-target",
      activeTargetUnchanged: true,
      backupId: "backup-2026-08-17",
      healthStatus: 200,
      migrationState: "0000_flaky_the_anarchist",
      pgvectorVersion: "0.8.1",
      readinessStatus: 200,
      restoredTargetFingerprint: "sha256:disposable-target",
      restoredWorkflowIds: Array.from({ length: 10 }, (_, index) => `workflow-${index}`),
      smokeToolCalls: 21,
      verifiedAt: "2026-08-17T03:00:00.000Z"
    },
    deploymentRecovery: {
      failedImage: digest("a"),
      failedRevision: "leg-stg-mcp--failed",
      failureObserved: true,
      healthStatus: 200,
      readinessStatus: 200,
      recoveredImage: digest("b"),
      recoveredRevision: "leg-stg-mcp--recovered",
      recoveryEvidence: "recovery/deployment.json",
      smokeToolCalls: 21,
      strategy: "rollback",
      verifiedAt: "2026-08-17T04:00:00.000Z"
    },
    diagnostics: ["database-outage", "document-extraction-failure", "openrouter-failure", "provider-timeout"].map(
      (scenario, index) => ({
        applicationEvidence: `diagnostics/${scenario}/application.json`,
        checkpointPreserved: true,
        correlationId: `workflow-${index}:execution-${index}`,
        recoveryEvidence: `diagnostics/${scenario}/recovery.json`,
        recoveryVerified: true,
        runId: `00000000-0000-4000-8000-00000000000${index}`,
        scenario,
        workflowEvidence: `diagnostics/${scenario}/workflow.json`,
        workflowExecutionId: `execution-${index}`
      })
    ),
    environment: "staging",
    generatedAt: "2026-08-17T05:00:00.000Z",
    version: 1
  }
}

describe("operational evidence validation", () => {
  it("accepts complete alert, diagnostic, restore, and deployment-recovery evidence", () => {
    expect(validateOperationalEvidence(evidence())).toMatchObject({
      alerts: expect.arrayContaining([expect.objectContaining({ name: "mcp-failures" })]),
      diagnostics: expect.arrayContaining([expect.objectContaining({ scenario: "database-outage" })]),
      environment: "staging",
      version: 1
    })
  })

  it("rejects incomplete diagnostic proof", () => {
    const input = evidence()
    input.diagnostics.pop()

    expect(() => validateOperationalEvidence(input)).toThrow("missing required evidence: provider-timeout")
  })

  it("rejects a restore aimed at the active database", () => {
    const input = evidence()
    input.databaseRestore.restoredTargetFingerprint = input.databaseRestore.activeTargetFingerprint

    expect(() => validateOperationalEvidence(input)).toThrow("restored target must be disposable")
  })
})
