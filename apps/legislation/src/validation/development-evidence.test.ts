import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  createDevelopmentEvidenceAudit,
  parseDevelopmentEvidenceBundle,
  verifyDevelopmentEvidenceArtifacts
} from "./development-evidence.js"

const generatedAt = "2026-08-17T18:00:00.000Z"
const commit = "1".repeat(40)
const image = `registry.example/legislation@sha256:${"2".repeat(64)}`

describe("development evidence audit", () => {
  it("passes the supported non-human gates when every receipt and artifact is complete", async () => {
    const directory = await mkdtemp(join(tmpdir(), "legislation-development-evidence-"))
    const bundle = await createBundle(directory)
    const verification = await verifyDevelopmentEvidenceArtifacts(bundle, directory)
    const audit = createDevelopmentEvidenceAudit(bundle, verification)

    expect(audit.ready).toBe(true)
    expect(audit.tasks).toHaveLength(18)
    expect(audit.tasks.every((task) => task.passed)).toBe(true)
    expect(audit.artifactVerification.every((artifact) => artifact.status === "verified")).toBe(true)
  })

  it("does not treat an interim source report as terminal release evidence", async () => {
    const directory = await mkdtemp(join(tmpdir(), "legislation-development-evidence-"))
    const bundle = await createBundle(directory)
    bundle.sourceCompletions[0] = {
      ...bundle.sourceCompletions[0],
      coverageFinal: false,
      status: "in-progress",
      terminalArtifacts: 9
    }
    const verification = await verifyDevelopmentEvidenceArtifacts(bundle, directory)
    const audit = createDevelopmentEvidenceAudit(bundle, verification)

    expect(task(audit, "M4.31").passed).toBe(false)
    expect(task(audit, "M14.10").passed).toBe(false)
    expect(task(audit, "M14.10").reasons).toContain("openstates coverage is marked as an interim report")
  })

  it("requires final jurisdiction coverage separately from a successful event import", async () => {
    const directory = await mkdtemp(join(tmpdir(), "legislation-development-evidence-"))
    const bundle = await createBundle(directory)
    const eventReceipt = bundle.expansionCompletions.find((completion) => completion.domain === "openstates-events")
    if (eventReceipt === undefined) {
      throw new Error("Missing Open States event receipt")
    }
    eventReceipt.coverageFinal = false
    const verification = await verifyDevelopmentEvidenceArtifacts(bundle, directory)
    const audit = createDevelopmentEvidenceAudit(bundle, verification)

    expect(task(audit, "E2.4").passed).toBe(true)
    expect(task(audit, "E2.9").passed).toBe(false)
    expect(task(audit, "E2.9").reasons).toContain("openstates-events coverage is marked as an interim report")
  })

  it("fails every gate that references a modified artifact", async () => {
    const directory = await mkdtemp(join(tmpdir(), "legislation-development-evidence-"))
    const bundle = await createBundle(directory)
    await writeFile(join(directory, "state-coverage.json"), "modified", "utf8")
    const verification = await verifyDevelopmentEvidenceArtifacts(bundle, directory)
    const audit = createDevelopmentEvidenceAudit(bundle, verification)

    expect(verification.find((artifact) => artifact.id === "state-coverage")?.status).toBe("mismatch")
    expect(task(audit, "M4.31").passed).toBe(false)
    expect(task(audit, "M14.10").passed).toBe(false)
  })

  it("rejects duplicate artifact identities", async () => {
    const directory = await mkdtemp(join(tmpdir(), "legislation-development-evidence-"))
    const bundle = await createBundle(directory)
    bundle.artifacts.push({ ...bundle.artifacts[0], path: "duplicate.json" })

    expect(() => parseDevelopmentEvidenceBundle(bundle)).toThrow("evidence artifact IDs must be unique")
  })
})

async function createBundle(directory: string) {
  const definitions = [
    ["state-coverage", "coverage-report", "state-coverage.json"],
    ["state-failures", "failure-report", "state-failures.json"],
    ["state-manifest", "openstates-discovery-manifest", "state-manifest.json"],
    ["federal-coverage", "coverage-report", "federal-coverage.json"],
    ["federal-failures", "failure-report", "federal-failures.json"],
    ["federal-manifest", "govinfo-discovery-manifest", "federal-manifest.json"],
    ["orchestration", "orchestration-run", "orchestration.json"],
    ["corpus-audit", "corpus-evidence-audit", "corpus-audit.json"],
    ["package-verify", "package-verification", "package-verify.json"],
    ["bicep", "bicep-validation", "bicep.json"],
    ["workflows", "workflow-validation", "workflows.json"],
    ["migration", "migration-from-zero", "migration.json"],
    ["deployment", "deployment-smoke", "deployment.json"],
    ["authenticated-smoke", "authenticated-mcp-smoke", "authenticated-smoke.json"],
    ["operations", "operational-evidence", "operations.json"],
    ["logs", "logs-and-traces", "logs.json"],
    ["gaps", "gap-reconciliation", "gaps.json"],
    ["completion", "completion-record", "completion.json"]
  ]
  const artifacts = []
  for (const [id, kind, path] of definitions) {
    const contents = `${id}-evidence\n`
    await writeFile(join(directory, path), contents, "utf8")
    artifacts.push({
      generatedAt,
      id,
      kind,
      path,
      sha256: createHash("sha256").update(contents).digest("hex")
    })
  }

  return {
    artifacts,
    completionRecord: {
      activeSchedules: ["congress-incremental"],
      artifactId: "completion",
      commit,
      corpusCoverage: "coverage report",
      evaluationBaseline: "evaluation baseline",
      image,
      knownLimitations: ["state data varies by jurisdiction"],
      migrationState: "current",
      performanceBaseline: "performance baseline",
      processingRates: "processing report",
      publishedAt: generatedAt
    },
    corpusEvidence: {
      artifactId: "corpus-audit",
      passedTasks: ["D2.6", "D2.10", "D2.12", "D2.14", "D2.15"],
      ready: true
    },
    environment: "development",
    expansionCompletions: [
      "congress-amendments",
      "congress-events",
      "congress-house-votes",
      "federal-supporting-materials",
      "openstates-entities",
      "openstates-events",
      "openstates-supporting-materials"
    ].map((domain) => ({
      completedAt: generatedAt,
      coverageArtifactId: "state-coverage",
      coverageFinal: true,
      discoveredRecords: 10,
      domain,
      failureArtifactId: "state-failures",
      runId: randomUUID(),
      status: "succeeded",
      terminalRecords: 10,
      unexplainedMaterialGaps: 0
    })),
    gapReconciliation: {
      artifactId: "gaps",
      discoveredArtifacts: 20,
      reconciledArtifacts: 20,
      unexplainedMaterialGaps: 0
    },
    generatedAt,
    observability: {
      artifactIds: ["operations", "logs", "state-coverage"],
      checks: [
        "azure-alerts",
        "azure-logs",
        "coverage-report",
        "evidence-retention",
        "langfuse-traces",
        "operator-runbooks"
      ],
      completedAt: generatedAt,
      status: "passed"
    },
    orchestration: {
      artifactId: "orchestration",
      completedAt: generatedAt,
      jobResults: ["source", "documents", "embeddings", "coverage"].map((operation) => ({
        applicationRunId: randomUUID(),
        operation,
        status: "succeeded"
      })),
      runId: randomUUID(),
      status: "succeeded",
      steps: ["source-ingestion", "document-processing", "embedding-refresh", "coverage-report"],
      workflowExecutionUrl: "https://n8n.example/execution/1"
    },
    sourceCompletions: [
      {
        completedAt: generatedAt,
        coverageArtifactId: "state-coverage",
        coverageFinal: true,
        discoveredArtifacts: 10,
        failureArtifactId: "state-failures",
        manifestArtifactId: "state-manifest",
        runId: randomUUID(),
        source: "openstates",
        status: "succeeded",
        terminalArtifacts: 10,
        unexplainedMaterialGaps: 0
      },
      {
        completedAt: generatedAt,
        coverageArtifactId: "federal-coverage",
        coverageFinal: true,
        discoveredArtifacts: 10,
        failureArtifactId: "federal-failures",
        manifestArtifactId: "federal-manifest",
        runId: randomUUID(),
        source: "govinfo",
        status: "succeeded",
        terminalArtifacts: 10,
        unexplainedMaterialGaps: 0
      }
    ],
    verification: {
      artifactIds: ["package-verify", "bicep", "workflows", "migration", "deployment", "authenticated-smoke"],
      checks: [
        "package-verify",
        "bicep-build",
        "bicep-lint",
        "workflow-validation",
        "migration-from-zero",
        "deployment-smoke",
        "authenticated-mcp-smoke"
      ],
      commit,
      completedAt: generatedAt,
      status: "passed"
    },
    version: 1
  }
}

function task(audit: ReturnType<typeof createDevelopmentEvidenceAudit>, id: string) {
  const result = audit.tasks.find((candidate) => candidate.id === id)
  if (result === undefined) {
    throw new Error(`Missing task ${id}`)
  }
  return result
}
