import { createHash } from "node:crypto"
import { matchesGlob } from "node:path"
import type { Assignment } from "../contracts/assignment"

export interface ContextArtifact {
  relativePath: string
  content: Buffer
  mediaType: "application/json" | "text/markdown"
  sha256: string
}

interface ContextManifestEntry {
  relativePath: string
  mediaType: ContextArtifact["mediaType"]
  byteLength: number
  sha256: string
  provenance: "validated-assignment"
  trust: "trusted-orchestrator-input"
}

export function sha256(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex")
}

function json(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`)
}

function assignmentMarkdown(assignment: Assignment): Buffer {
  const criteria = assignment.acceptanceCriteria.map((criterion) => `- ${criterion}`).join("\n")
  const relevantPaths = assignment.relevantPaths.map((path) => `- \`${path}\``).join("\n") || "- None specified"

  return Buffer.from(
    `# Assignment\n\n## Objective\n\n${assignment.objective}\n\n## Acceptance criteria\n\n${criteria}\n\n## Relevant paths\n\n${relevantPaths}\n`
  )
}

function createArtifact(
  relativePath: string,
  content: Buffer,
  mediaType: ContextArtifact["mediaType"]
): ContextArtifact {
  return { relativePath, content, mediaType, sha256: sha256(content) }
}

export function createContextBundle(assignment: Assignment): ContextArtifact[] {
  const sourceArtifacts = [
    createArtifact("assignment.md", assignmentMarkdown(assignment), "text/markdown"),
    createArtifact("acceptance-criteria.json", json(assignment.acceptanceCriteria), "application/json"),
    createArtifact("validation-plan.json", json(assignment.validationCommands), "application/json"),
    createArtifact(
      "path-policy.json",
      json({ relevantPaths: assignment.relevantPaths, pathPolicy: assignment.pathPolicy }),
      "application/json"
    )
  ]
  const manifest: ContextManifestEntry[] = sourceArtifacts.map((artifact) => ({
    relativePath: artifact.relativePath,
    mediaType: artifact.mediaType,
    byteLength: artifact.content.byteLength,
    sha256: artifact.sha256,
    provenance: "validated-assignment",
    trust: "trusted-orchestrator-input"
  }))

  return [createArtifact("manifest.json", json(manifest), "application/json"), ...sourceArtifacts]
}

export function findPathPolicyViolations(assignment: Assignment, changedFiles: readonly string[]): string[] {
  return changedFiles.filter((file) => {
    const forbidden = assignment.pathPolicy.forbidden.some((pattern) => matchesGlob(file, pattern))
    const allowed = assignment.pathPolicy.allowed.some((pattern) => matchesGlob(file, pattern))
    return forbidden || !allowed
  })
}
