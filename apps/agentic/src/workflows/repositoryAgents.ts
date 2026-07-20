import { createHash } from "node:crypto"
import { z } from "zod"
import type { IntegrationCredentialBroker, BrokerConnection } from "../integrations/broker"
import type { IntegrationConnectionStore } from "../persistence/integrationStore"

const MAXIMUM_TREE_ENTRIES = 10_000
const MAXIMUM_AGENT_FILES = 100
const MAXIMUM_AGENT_BYTES = 131_072
const CommitShaSchema = z.string().regex(/^[0-9a-f]{40}$/u)
const BlobShaSchema = z.string().regex(/^[0-9a-f]{40}$/u)
const DigestSchema = z.string().regex(/^[0-9a-f]{64}$/u)
const AgentPathSchema = z.string().regex(/^\.github\/(?:[^/]+\/)*[^/]+\.agent\.md$/u)

export const RepositoryAgentReferenceSchema = z
  .object({
    connectionId: z.uuid(),
    repositoryId: z.string().trim().min(1),
    repositoryName: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u),
    ref: z.string().trim().min(1),
    path: AgentPathSchema,
    observedCommitSha: CommitShaSchema,
    blobSha: BlobShaSchema,
    contentDigest: DigestSchema,
    sourceUrl: z.url(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    requestedModel: z.string().trim().min(1).optional(),
    requestedTools: z.array(z.string().trim().min(1)).max(64)
  })
  .strict()

export const RepositoryAgentSnapshotSchema = z
  .object({
    reference: RepositoryAgentReferenceSchema,
    content: z.string().max(MAXIMUM_AGENT_BYTES),
    body: z.string().max(MAXIMUM_AGENT_BYTES),
    parserVersion: z.literal("1"),
    effectiveModel: z.string().trim().min(1).nullable(),
    effectiveTools: z.array(z.string().trim().min(1)).max(64)
  })
  .strict()

const GitHubCommitSchema = z.object({ sha: CommitShaSchema })
const GitHubTreeSchema = z.object({
  truncated: z.boolean().default(false),
  tree: z.array(z.object({ path: z.string(), type: z.enum(["blob", "tree", "commit"]), sha: BlobShaSchema }))
})
const GitHubBlobSchema = z.object({
  sha: BlobShaSchema,
  encoding: z.literal("base64"),
  content: z.string(),
  size: z.number().int().nonnegative().max(MAXIMUM_AGENT_BYTES)
})
const RepositoryAgentDiscoveryRequestSchema = z
  .object({
    connectionId: z.uuid(),
    repositoryId: z.string().trim().min(1),
    repositoryName: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u),
    ref: z.string().trim().min(1).default("HEAD")
  })
  .strict()

type ParsedAgent = {
  name: string
  description: string
  requestedModel?: string
  requestedTools: string[]
  body: string
}

function digest(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

function scalar(value: string): string {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function inlineList(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error("Agent tools must be an inline list or an indented list")
  }
  const inner = trimmed.slice(1, -1).trim()
  return inner === ""
    ? []
    : inner
        .split(",")
        .map((item) => scalar(item))
        .filter(Boolean)
}

export function parseRepositoryAgent(content: string, path: string): ParsedAgent {
  if (Buffer.byteLength(content) > MAXIMUM_AGENT_BYTES) throw new Error(`Repository agent ${path} is too large`)
  const lines = content.replace(/\r\n?/gu, "\n").split("\n")
  if (lines[0] !== "---") throw new Error(`Repository agent ${path} has no frontmatter`)
  const end = lines.indexOf("---", 1)
  if (end < 0) throw new Error(`Repository agent ${path} has unterminated frontmatter`)
  const metadata: Record<string, string | string[]> = {}
  let listKey: string | undefined
  for (const line of lines.slice(1, end)) {
    const listItem = /^\s+-\s+(.+)$/u.exec(line)
    if (listItem !== null && listKey !== undefined) {
      const current = metadata[listKey]
      if (!Array.isArray(current)) throw new Error(`Repository agent ${path} has invalid ${listKey}`)
      current.push(scalar(listItem[1] ?? ""))
      continue
    }
    const entry = /^([a-zA-Z][a-zA-Z0-9_-]*):(?:\s*(.*))?$/u.exec(line)
    if (entry === null) {
      if (line.trim() === "") continue
      throw new Error(`Repository agent ${path} has unsupported frontmatter syntax`)
    }
    const key = entry[1] ?? ""
    if (!new Set(["name", "description", "model", "tools"]).has(key)) {
      throw new Error(`Repository agent ${path} uses unsupported frontmatter key ${key}`)
    }
    const value = entry[2] ?? ""
    if (key === "tools") {
      metadata[key] = value.trim() === "" ? [] : inlineList(value)
      listKey = key
    } else {
      metadata[key] = scalar(value)
      listKey = undefined
    }
  }
  const defaultName =
    path
      .split("/")
      .at(-1)
      ?.replace(/\.agent\.md$/u, "") ?? "Agent"
  const name = z
    .string()
    .trim()
    .min(1)
    .max(120)
    .parse(metadata.name ?? defaultName)
  const description = z.string().trim().min(1).max(500).parse(metadata.description)
  const requestedTools = z
    .array(z.string().trim().min(1))
    .max(64)
    .parse(metadata.tools ?? [])
  const requestedModel = metadata.model === undefined ? undefined : z.string().trim().min(1).parse(metadata.model)
  return {
    name,
    description,
    requestedTools,
    body: lines
      .slice(end + 1)
      .join("\n")
      .trim(),
    ...(requestedModel === undefined ? {} : { requestedModel })
  }
}

function brokerConnection(record: Awaited<ReturnType<IntegrationConnectionStore["getConnection"]>>): BrokerConnection {
  if (record === null) throw new Error("Integration connection not found")
  if (record.provider !== "github" || record.status !== "connected") {
    throw new Error("A connected GitHub integration is required")
  }
  return {
    providerConfigKey: record.providerConfigKey,
    connectionId: record.nangoConnectionId,
    displayName: record.displayName,
    healthy: true,
    errorCode: null
  }
}

export class RepositoryAgentCatalog {
  readonly #broker: IntegrationCredentialBroker
  readonly #store: IntegrationConnectionStore

  constructor(broker: IntegrationCredentialBroker, store: IntegrationConnectionStore) {
    this.#broker = broker
    this.#store = store
  }

  async discover(input: unknown): Promise<z.infer<typeof RepositoryAgentReferenceSchema>[]> {
    const request = RepositoryAgentDiscoveryRequestSchema.parse(input)
    const connection = brokerConnection(await this.#store.getConnection(request.connectionId))
    const resource = (await this.#store.listResources(request.connectionId)).find(
      (candidate) =>
        candidate.resourceType === "repository" &&
        candidate.externalId === request.repositoryId &&
        candidate.name === request.repositoryName &&
        !candidate.stale
    )
    if (resource === undefined) throw new Error("Repository binding is unavailable or stale")
    const endpoint = `/repos/${request.repositoryName}`
    const commit = GitHubCommitSchema.parse(
      await this.#broker.request(connection, {
        method: "GET",
        endpoint: `${endpoint}/commits/${encodeURIComponent(request.ref)}`
      })
    )
    const tree = GitHubTreeSchema.parse(
      await this.#broker.request(connection, {
        method: "GET",
        endpoint: `${endpoint}/git/trees/${commit.sha}`,
        params: { recursive: 1 }
      })
    )
    if (tree.truncated || tree.tree.length > MAXIMUM_TREE_ENTRIES)
      throw new Error("Repository tree exceeds the bounded discovery limit")
    const candidates = tree.tree.filter(
      (entry) => entry.type === "blob" && AgentPathSchema.safeParse(entry.path).success
    )
    if (candidates.length > MAXIMUM_AGENT_FILES)
      throw new Error(`Repository contains more than ${MAXIMUM_AGENT_FILES} agent definitions`)
    const references = await Promise.all(
      candidates.map(async (entry) => {
        const { content } = await this.#blob(connection, request.repositoryName, entry.sha)
        const parsed = parseRepositoryAgent(content, entry.path)
        return RepositoryAgentReferenceSchema.parse({
          ...request,
          path: entry.path,
          observedCommitSha: commit.sha,
          blobSha: entry.sha,
          contentDigest: digest(content),
          sourceUrl: `https://github.com/${request.repositoryName}/blob/${commit.sha}/${entry.path}`,
          name: parsed.name,
          description: parsed.description,
          ...(parsed.requestedModel === undefined ? {} : { requestedModel: parsed.requestedModel }),
          requestedTools: parsed.requestedTools
        })
      })
    )
    return references.sort((left, right) => left.path.localeCompare(right.path))
  }

  async resolve(referenceInput: unknown): Promise<z.infer<typeof RepositoryAgentSnapshotSchema>> {
    const reference = RepositoryAgentReferenceSchema.parse(referenceInput)
    const connection = brokerConnection(await this.#store.getConnection(reference.connectionId))
    const { content } = await this.#blob(connection, reference.repositoryName, reference.blobSha)
    if (digest(content) !== reference.contentDigest)
      throw new Error(`Repository agent ${reference.path} changed content`)
    const parsed = parseRepositoryAgent(content, reference.path)
    if (parsed.name !== reference.name || parsed.description !== reference.description) {
      throw new Error(`Repository agent ${reference.path} metadata no longer matches its reference`)
    }
    return RepositoryAgentSnapshotSchema.parse({
      reference,
      content,
      body: parsed.body,
      parserVersion: "1",
      effectiveModel: parsed.requestedModel ?? null,
      effectiveTools: parsed.requestedTools
    })
  }

  async #blob(connection: BrokerConnection, repositoryName: string, blobSha: string): Promise<{ content: string }> {
    const blob = GitHubBlobSchema.parse(
      await this.#broker.request(connection, {
        method: "GET",
        endpoint: `/repos/${repositoryName}/git/blobs/${blobSha}`
      })
    )
    const bytes = Buffer.from(blob.content.replace(/\s/gu, ""), "base64")
    if (bytes.byteLength !== blob.size || bytes.byteLength > MAXIMUM_AGENT_BYTES) {
      throw new Error(`Repository agent blob ${blobSha} has an invalid size`)
    }
    return { content: bytes.toString("utf8") }
  }
}

export type RepositoryAgentSnapshot = z.infer<typeof RepositoryAgentSnapshotSchema>
