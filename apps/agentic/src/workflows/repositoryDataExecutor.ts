import { z } from "zod"
import type { WorkflowStepInstance } from "./definition"
import { JsonValueSchema, type JsonValue } from "./executionContracts"

const MAXIMUM_FILE_BYTES = 65_536
const MAXIMUM_ITEMS = 100
const RepositorySchema = z
  .object({
    owner: z.string().regex(/^[A-Za-z0-9_.-]+$/u),
    name: z.string().regex(/^[A-Za-z0-9_.-]+$/u),
    ref: z.string().trim().min(1).default("HEAD")
  })
  .strict()
const RepositoryDataConfigSchema = z
  .object({
    operation: z.enum([
      "metadata",
      "file_content",
      "commit",
      "code_search",
      "pull_request",
      "pull_request_files",
      "checks",
      "reviews",
      "comments"
    ]),
    repository: RepositorySchema
  })
  .strict()
const JsonObjectSchema = z.record(z.string(), JsonValueSchema)
const GitHubErrorSchema = z.object({ message: z.string().optional() }).passthrough()
const RepositoryMetadataSchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string(),
  description: z.string().nullable(),
  private: z.boolean(),
  archived: z.boolean(),
  default_branch: z.string(),
  html_url: z.url()
})
const FileContentSchema = z.object({
  type: z.literal("file"),
  path: z.string(),
  sha: z.string(),
  size: z.number().int().nonnegative().max(MAXIMUM_FILE_BYTES),
  encoding: z.literal("base64"),
  content: z.string(),
  html_url: z.url().nullable()
})
const CommitSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/u),
  html_url: z.url(),
  commit: z.object({
    message: z.string(),
    author: z.object({ name: z.string(), email: z.string(), date: z.iso.datetime({ offset: true }) }).nullable()
  })
})
const SearchSchema = z.object({
  total_count: z.number().int().nonnegative(),
  incomplete_results: z.boolean(),
  items: z
    .array(z.object({ name: z.string(), path: z.string(), sha: z.string(), html_url: z.url() }))
    .max(MAXIMUM_ITEMS)
})
const PullRequestSchema = z.object({
  number: z.number().int().positive(),
  state: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  draft: z.boolean(),
  html_url: z.url(),
  head: z.object({ sha: z.string() }),
  base: z.object({ sha: z.string() }),
  user: z.object({ login: z.string() }).nullable()
})
const PullRequestFileSchema = z.object({
  sha: z.string(),
  filename: z.string(),
  status: z.string(),
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  changes: z.number().int().nonnegative(),
  blob_url: z.url(),
  patch: z.string().max(MAXIMUM_FILE_BYTES).optional()
})
const CheckRunsSchema = z.object({
  total_count: z.number().int().nonnegative(),
  check_runs: z
    .array(
      z.object({
        id: z.number().int().positive(),
        name: z.string(),
        status: z.string(),
        conclusion: z.string().nullable(),
        html_url: z.url().nullable()
      })
    )
    .max(MAXIMUM_ITEMS)
})
const ReviewSchema = z.object({
  id: z.number().int().positive(),
  user: z.object({ login: z.string() }).nullable(),
  body: z.string(),
  state: z.string(),
  html_url: z.url()
})
const CommentSchema = z.object({
  id: z.number().int().positive(),
  user: z.object({ login: z.string() }).nullable(),
  body: z.string(),
  html_url: z.url(),
  created_at: z.iso.datetime({ offset: true })
})

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export class GitHubRepositoryDataReader {
  readonly #tokenProvider: () => Promise<string>
  readonly #fetcher: Fetcher
  readonly #apiBaseUrl: string

  constructor(options: { tokenProvider: () => Promise<string>; fetcher?: Fetcher; apiBaseUrl?: string }) {
    this.#tokenProvider = options.tokenProvider
    this.#fetcher = options.fetcher ?? fetch
    this.#apiBaseUrl = (options.apiBaseUrl ?? "https://api.github.com").replace(/\/$/u, "")
  }

  async execute(step: WorkflowStepInstance, inputValue: Record<string, JsonValue>): Promise<Record<string, JsonValue>> {
    const config = RepositoryDataConfigSchema.parse(step.config)
    const query = JsonObjectSchema.parse(inputValue.query ?? {})
    const repositoryPath = `/repos/${config.repository.owner}/${config.repository.name}`
    let result: JsonValue
    if (config.operation === "metadata") {
      const value = RepositoryMetadataSchema.parse(await this.#get(repositoryPath))
      result = {
        id: value.id,
        name: value.full_name,
        description: value.description,
        private: value.private,
        archived: value.archived,
        defaultBranch: value.default_branch,
        url: value.html_url
      }
    } else if (config.operation === "file_content") {
      const path = z.string().trim().min(1).parse(query.path)
      const value = FileContentSchema.parse(
        await this.#get(`${repositoryPath}/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
          ref: typeof query.ref === "string" ? query.ref : config.repository.ref
        })
      )
      const bytes = Buffer.from(value.content.replace(/\s/gu, ""), "base64")
      if (bytes.byteLength !== value.size) throw new Error("GitHub file content size did not match metadata")
      result = {
        path: value.path,
        sha: value.sha,
        size: value.size,
        content: bytes.toString("utf8"),
        url: value.html_url
      }
    } else if (config.operation === "commit") {
      const reference = typeof query.ref === "string" ? query.ref : config.repository.ref
      const value = CommitSchema.parse(await this.#get(`${repositoryPath}/commits/${encodeURIComponent(reference)}`))
      result = {
        sha: value.sha,
        message: value.commit.message,
        author: value.commit.author,
        url: value.html_url
      }
    } else if (config.operation === "code_search") {
      const text = z.string().trim().min(1).max(500).parse(query.text)
      const maximumItems = z
        .number()
        .int()
        .min(1)
        .max(MAXIMUM_ITEMS)
        .parse(query.maximumItems ?? 25)
      const value = SearchSchema.parse(
        await this.#get("/search/code", {
          q: `${text} repo:${config.repository.owner}/${config.repository.name}`,
          per_page: maximumItems
        })
      )
      result = {
        totalCount: value.total_count,
        incomplete: value.incomplete_results,
        items: value.items.slice(0, maximumItems)
      }
    } else {
      const pullRequestNumber = z.number().int().positive().parse(query.pullRequestNumber)
      if (config.operation === "pull_request") {
        result = PullRequestSchema.parse(await this.#get(`${repositoryPath}/pulls/${pullRequestNumber}`))
      } else if (config.operation === "pull_request_files") {
        result = z
          .array(PullRequestFileSchema)
          .max(MAXIMUM_ITEMS)
          .parse(await this.#get(`${repositoryPath}/pulls/${pullRequestNumber}/files`, { per_page: MAXIMUM_ITEMS }))
      } else if (config.operation === "reviews") {
        result = z
          .array(ReviewSchema)
          .max(MAXIMUM_ITEMS)
          .parse(await this.#get(`${repositoryPath}/pulls/${pullRequestNumber}/reviews`, { per_page: MAXIMUM_ITEMS }))
      } else if (config.operation === "comments") {
        result = z
          .array(CommentSchema)
          .max(MAXIMUM_ITEMS)
          .parse(await this.#get(`${repositoryPath}/issues/${pullRequestNumber}/comments`, { per_page: MAXIMUM_ITEMS }))
      } else {
        const reference = typeof query.ref === "string" ? query.ref : config.repository.ref
        result = CheckRunsSchema.parse(
          await this.#get(`${repositoryPath}/commits/${encodeURIComponent(reference)}/check-runs`, {
            per_page: MAXIMUM_ITEMS
          })
        )
      }
    }
    return { result }
  }

  async #get(path: string, parameters: Record<string, string | number> = {}): Promise<unknown> {
    const url = new URL(`${this.#apiBaseUrl}${path}`)
    for (const [name, value] of Object.entries(parameters)) url.searchParams.set(name, String(value))
    const response = await this.#fetcher(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${await this.#tokenProvider()}`,
        "X-GitHub-Api-Version": "2022-11-28"
      }
    })
    if (!response.ok) {
      const body = GitHubErrorSchema.safeParse(await response.json())
      throw new Error(
        `GitHub repository read failed with status ${response.status}: ${body.success ? (body.data.message ?? "Unknown error") : "Invalid response"}`
      )
    }
    return response.json()
  }
}

export type RepositoryDataExecutor = GitHubRepositoryDataReader["execute"]
