import { randomUUID } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import type { IntegrationCredentialBroker } from "../integrations/broker"
import type { IntegrationConnectionStore } from "../persistence/integrationStore"
import { parseRepositoryAgent, RepositoryAgentCatalog } from "./repositoryAgents"

const connectionId = randomUUID()
const commitSha = "a".repeat(40)
const reviewerBlobSha = "b".repeat(40)
const plannerBlobSha = "c".repeat(40)
const repositoryName = "agency/repository"
const reviewerContent = `---
name: Reviewer
description: Reviews candidate changes
model: openai/gpt-5.4
tools:
  - read
  - search
---
# Review

Inspect the candidate and return evidence.
`
const plannerContent = `---
name: Planner
description: Plans bounded changes
tools: [read, search]
---
# Plan
`

function base64(content: string) {
  return {
    encoding: "base64" as const,
    content: Buffer.from(content).toString("base64"),
    size: Buffer.byteLength(content)
  }
}

function store(status: "connected" | "degraded" = "connected"): IntegrationConnectionStore {
  return {
    listConnections: vi.fn(async () => []),
    getConnection: vi.fn(async () => ({
      connectionId,
      provider: "github" as const,
      providerConfigKey: "github-app",
      nangoConnectionId: "nango-github",
      displayName: "GitHub",
      status,
      errorCode: null,
      lastCheckedAt: new Date(),
      disconnectedAt: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })),
    upsertConnection: vi.fn(),
    updateConnectionHealth: vi.fn(async () => undefined),
    listResources: vi.fn(async () => [
      {
        resourceId: randomUUID(),
        connectionId,
        resourceType: "repository" as const,
        externalId: "42",
        name: repositoryName,
        stale: false,
        lastDiscoveredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]),
    replaceDiscoveredResources: vi.fn(async () => undefined)
  }
}

function broker(blobOverride?: string): IntegrationCredentialBroker {
  return {
    createAuthorizationSession: vi.fn(),
    createReconnectSession: vi.fn(),
    listConnections: vi.fn(async () => []),
    revoke: vi.fn(async () => undefined),
    request: vi.fn(async (_connection, request) => {
      if (request.endpoint.includes("/commits/")) return { sha: commitSha }
      if (request.endpoint.includes("/git/trees/")) {
        return {
          truncated: false,
          tree: [
            { path: "src/index.ts", type: "blob", sha: "d".repeat(40) },
            { path: ".github/reviewer.agent.md", type: "blob", sha: reviewerBlobSha },
            { path: ".github/agents/planner.agent.md", type: "blob", sha: plannerBlobSha }
          ]
        }
      }
      if (request.endpoint.endsWith(reviewerBlobSha))
        return { sha: reviewerBlobSha, ...base64(blobOverride ?? reviewerContent) }
      if (request.endpoint.endsWith(plannerBlobSha)) return { sha: plannerBlobSha, ...base64(plannerContent) }
      throw new Error(`Unexpected endpoint ${request.endpoint}`)
    })
  }
}

describe("repository agent catalog", () => {
  it("parses the supported frontmatter subset", () => {
    expect(parseRepositoryAgent(reviewerContent, ".github/reviewer.agent.md")).toEqual({
      name: "Reviewer",
      description: "Reviews candidate changes",
      requestedModel: "openai/gpt-5.4",
      requestedTools: ["read", "search"],
      body: "# Review\n\nInspect the candidate and return evidence."
    })
    expect(() => parseRepositoryAgent("---\nunknown: value\n---\n", ".github/bad.agent.md")).toThrow(
      "unsupported frontmatter key unknown"
    )
  })

  it("discovers bounded repository agents pinned to commit, blob, and content digests", async () => {
    const catalog = new RepositoryAgentCatalog(broker(), store())

    const result = await catalog.discover({ connectionId, repositoryId: "42", repositoryName, ref: "main" })

    expect(result.map(({ path }) => path)).toEqual([".github/agents/planner.agent.md", ".github/reviewer.agent.md"])
    expect(result[1]).toMatchObject({
      observedCommitSha: commitSha,
      blobSha: reviewerBlobSha,
      requestedModel: "openai/gpt-5.4",
      requestedTools: ["read", "search"],
      sourceUrl: `https://github.com/${repositoryName}/blob/${commitSha}/.github/reviewer.agent.md`
    })
    expect(result[1]?.contentDigest).toMatch(/^[0-9a-f]{64}$/u)
  })

  it("resolves immutable snapshots and rejects changed content", async () => {
    const catalog = new RepositoryAgentCatalog(broker(), store())
    const reference = (await catalog.discover({ connectionId, repositoryId: "42", repositoryName, ref: "main" }))[1]!

    await expect(catalog.resolve(reference)).resolves.toMatchObject({
      reference,
      parserVersion: "1",
      effectiveModel: "openai/gpt-5.4",
      effectiveTools: ["read", "search"],
      body: "# Review\n\nInspect the candidate and return evidence."
    })
    await expect(
      new RepositoryAgentCatalog(broker(`${reviewerContent}\nchanged`), store()).resolve(reference)
    ).rejects.toThrow("changed content")
  })

  it("fails closed when the integration is not connected", async () => {
    await expect(
      new RepositoryAgentCatalog(broker(), store("degraded")).discover({
        connectionId,
        repositoryId: "42",
        repositoryName,
        ref: "main"
      })
    ).rejects.toThrow("connected GitHub integration")
  })
})
