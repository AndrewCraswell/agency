import { describe, expect, it, vi } from "vitest"
import { GitHubRepositoryDataReader } from "./repositoryDataExecutor"

function step(operation: string) {
  return {
    id: "repository-data",
    label: "Repository data",
    position: { x: 0, y: 0 },
    definition: { kind: "repository_data", version: 1 },
    config: { operation, repository: { owner: "agency", name: "repository", ref: "main" } },
    failurePolicy: { mode: "stop" as const, maximumAttempts: 1 }
  }
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

function createFetcher(body: unknown, status = 200) {
  return vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () =>
    response(body, status)
  )
}

function createReader(fetcher: (input: string | URL | Request, init?: RequestInit) => Promise<Response>) {
  return new GitHubRepositoryDataReader({ tokenProvider: async () => "token", fetcher })
}

function requestedUrl(fetcher: ReturnType<typeof createFetcher>, callIndex = 0) {
  const requested = fetcher.mock.calls[callIndex]?.[0]
  if (!(requested instanceof URL)) throw new Error("Expected URL request input")
  return requested
}

describe("GitHubRepositoryDataReader", () => {
  it("returns provider-neutral bounded repository metadata", async () => {
    const fetcher = createFetcher({
      id: 42,
      full_name: "agency/repository",
      description: "Workflow platform",
      private: true,
      archived: false,
      default_branch: "main",
      html_url: "https://github.com/agency/repository"
    })
    const reader = createReader(fetcher)

    await expect(reader.execute(step("metadata"), {})).resolves.toEqual({
      result: {
        id: 42,
        name: "agency/repository",
        description: "Workflow platform",
        private: true,
        archived: false,
        defaultBranch: "main",
        url: "https://github.com/agency/repository"
      }
    })
    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository")
    expect(requestedUrl(fetcher).search).toBe("")
    expect(fetcher.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/vnd.github+json",
          Authorization: "Bearer token",
          "X-GitHub-Api-Version": "2022-11-28"
        })
      })
    )
  })

  it("decodes bounded file content at the configured repository ref", async () => {
    const fetcher = createFetcher({
      type: "file",
      path: "README.md",
      sha: "a".repeat(40),
      size: 7,
      encoding: "base64",
      content: Buffer.from("# Read\n").toString("base64"),
      html_url: "https://github.com/agency/repository/blob/main/README.md"
    })
    const reader = createReader(fetcher)

    await expect(reader.execute(step("file_content"), { query: { path: "README.md" } })).resolves.toEqual({
      result: {
        path: "README.md",
        sha: "a".repeat(40),
        size: 7,
        content: "# Read\n",
        url: "https://github.com/agency/repository/blob/main/README.md"
      }
    })
    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/contents/README.md")
    expect(requestedUrl(fetcher).search).toBe("?ref=main")
  })

  it("uses an explicit query ref for file content", async () => {
    const fetcher = createFetcher({
      type: "file",
      path: "docs/space name.md",
      sha: "f".repeat(40),
      size: 7,
      encoding: "base64",
      content: Buffer.from("content").toString("base64"),
      html_url: "https://github.com/agency/repository/blob/release/docs/space%20name.md"
    })
    const reader = createReader(fetcher)

    await reader.execute(step("file_content"), { query: { path: "docs/space name.md", ref: "release/1.0" } })

    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/contents/docs/space%20name.md")
    expect(requestedUrl(fetcher).search).toBe("?ref=release%2F1.0")
  })

  it("throws when decoded file bytes do not match metadata size", async () => {
    const fetcher = createFetcher({
      type: "file",
      path: "README.md",
      sha: "a".repeat(40),
      size: 99,
      encoding: "base64",
      content: Buffer.from("# Read\n").toString("base64"),
      html_url: "https://github.com/agency/repository/blob/main/README.md"
    })
    const reader = createReader(fetcher)

    await expect(reader.execute(step("file_content"), { query: { path: "README.md" } })).rejects.toThrow(
      "GitHub file content size did not match metadata"
    )
  })

  it("reads a commit at the configured default ref", async () => {
    const fetcher = createFetcher({
      sha: "c".repeat(40),
      html_url: "https://github.com/agency/repository/commit/cccc",
      commit: {
        message: "Default ref commit",
        author: { name: "Ada", email: "ada@example.com", date: "2025-01-01T00:00:00+00:00" }
      }
    })
    const reader = createReader(fetcher)

    await expect(reader.execute(step("commit"), { query: {} })).resolves.toEqual({
      result: {
        sha: "c".repeat(40),
        message: "Default ref commit",
        author: { name: "Ada", email: "ada@example.com", date: "2025-01-01T00:00:00+00:00" },
        url: "https://github.com/agency/repository/commit/cccc"
      }
    })
    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/commits/main")
    expect(requestedUrl(fetcher).search).toBe("")
  })

  it("reads a commit at an explicit query ref", async () => {
    const fetcher = createFetcher({
      sha: "d".repeat(40),
      html_url: "https://github.com/agency/repository/commit/dddd",
      commit: {
        message: "Query ref commit",
        author: { name: "Lin", email: "lin@example.com", date: "2025-01-02T00:00:00+00:00" }
      }
    })
    const reader = createReader(fetcher)

    await reader.execute(step("commit"), { query: { ref: "feature/ref-check" } })

    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/commits/feature%2Fref-check")
    expect(requestedUrl(fetcher).search).toBe("")
  })

  it("falls back to configured ref when query ref is unsupported", async () => {
    const fetcher = createFetcher({
      sha: "e".repeat(40),
      html_url: "https://github.com/agency/repository/commit/eeee",
      commit: {
        message: "Fallback ref",
        author: { name: "Pat", email: "pat@example.com", date: "2025-01-03T00:00:00+00:00" }
      }
    })
    const reader = createReader(fetcher)

    await reader.execute(step("commit"), { query: { ref: 7 } })

    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/commits/main")
  })

  it("scopes code search to the repository and requested bound", async () => {
    const fetcher = createFetcher({
      total_count: 1,
      incomplete_results: false,
      items: [
        {
          name: "index.ts",
          path: "src/index.ts",
          sha: "b".repeat(40),
          html_url: "https://github.com/agency/repository/blob/main/src/index.ts"
        }
      ]
    })
    const reader = createReader(fetcher)

    await expect(
      reader.execute(step("code_search"), { query: { text: "workflow", maximumItems: 10 } })
    ).resolves.toEqual({
      result: {
        totalCount: 1,
        incomplete: false,
        items: [
          {
            name: "index.ts",
            path: "src/index.ts",
            sha: "b".repeat(40),
            html_url: "https://github.com/agency/repository/blob/main/src/index.ts"
          }
        ]
      }
    })

    const requested = requestedUrl(fetcher)
    expect(requested.pathname).toBe("/search/code")
    expect(requested.searchParams.get("q")).toBe("workflow repo:agency/repository")
    expect(requested.searchParams.get("per_page")).toBe("10")
  })

  it.each([
    ["file_content", { path: " " }],
    ["code_search", { text: "" }],
    ["pull_request", { pullRequestNumber: 0 }],
    ["pull_request_files", {}],
    ["reviews", { pullRequestNumber: -1 }],
    ["comments", { pullRequestNumber: 1.5 }]
  ])("rejects invalid query input for %s", async (operation, query) => {
    const fetcher = createFetcher({})
    const reader = createReader(fetcher)

    await expect(reader.execute(step(operation), { query })).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("returns pull request details", async () => {
    const fetcher = createFetcher({
      number: 12,
      state: "open",
      title: "Improve workflow",
      body: "Details",
      draft: false,
      html_url: "https://github.com/agency/repository/pull/12",
      head: { sha: "1".repeat(40) },
      base: { sha: "2".repeat(40) },
      user: { login: "octocat" }
    })
    const reader = createReader(fetcher)

    await expect(reader.execute(step("pull_request"), { query: { pullRequestNumber: 12 } })).resolves.toEqual({
      result: {
        number: 12,
        state: "open",
        title: "Improve workflow",
        body: "Details",
        draft: false,
        html_url: "https://github.com/agency/repository/pull/12",
        head: { sha: "1".repeat(40) },
        base: { sha: "2".repeat(40) },
        user: { login: "octocat" }
      }
    })

    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/pulls/12")
    expect(requestedUrl(fetcher).search).toBe("")
  })

  it("returns pull request files with bounded query", async () => {
    const fetcher = createFetcher([
      {
        sha: "3".repeat(40),
        filename: "src/workflows/repositoryDataExecutor.ts",
        status: "modified",
        additions: 10,
        deletions: 2,
        changes: 12,
        blob_url: "https://github.com/agency/repository/blob/main/src/workflows/repositoryDataExecutor.ts",
        patch: "@@ -1,2 +1,3 @@"
      }
    ])
    const reader = createReader(fetcher)

    await expect(reader.execute(step("pull_request_files"), { query: { pullRequestNumber: 12 } })).resolves.toEqual({
      result: [
        {
          sha: "3".repeat(40),
          filename: "src/workflows/repositoryDataExecutor.ts",
          status: "modified",
          additions: 10,
          deletions: 2,
          changes: 12,
          blob_url: "https://github.com/agency/repository/blob/main/src/workflows/repositoryDataExecutor.ts",
          patch: "@@ -1,2 +1,3 @@"
        }
      ]
    })

    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/pulls/12/files")
    expect(requestedUrl(fetcher).search).toBe("?per_page=100")
  })

  it("returns checks at configured ref", async () => {
    const fetcher = createFetcher({
      total_count: 1,
      check_runs: [
        {
          id: 1,
          name: "build",
          status: "completed",
          conclusion: "success",
          html_url: "https://github.com/agency/repository/runs/1"
        }
      ]
    })
    const reader = createReader(fetcher)

    await expect(reader.execute(step("checks"), { query: {} })).resolves.toEqual({
      result: {
        total_count: 1,
        check_runs: [
          {
            id: 1,
            name: "build",
            status: "completed",
            conclusion: "success",
            html_url: "https://github.com/agency/repository/runs/1"
          }
        ]
      }
    })

    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/commits/main/check-runs")
    expect(requestedUrl(fetcher).search).toBe("?per_page=100")
  })

  it("returns checks at explicit query ref", async () => {
    const fetcher = createFetcher({
      total_count: 0,
      check_runs: []
    })
    const reader = createReader(fetcher)

    await reader.execute(step("checks"), { query: { ref: "release/v1" } })

    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/commits/release%2Fv1/check-runs")
    expect(requestedUrl(fetcher).search).toBe("?per_page=100")
  })

  it("returns pull request reviews", async () => {
    const fetcher = createFetcher([
      {
        id: 101,
        user: { login: "reviewer" },
        body: "Looks good",
        state: "APPROVED",
        html_url: "https://github.com/agency/repository/pull/12#pullrequestreview-101"
      }
    ])
    const reader = createReader(fetcher)

    await expect(reader.execute(step("reviews"), { query: { pullRequestNumber: 12 } })).resolves.toEqual({
      result: [
        {
          id: 101,
          user: { login: "reviewer" },
          body: "Looks good",
          state: "APPROVED",
          html_url: "https://github.com/agency/repository/pull/12#pullrequestreview-101"
        }
      ]
    })

    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/pulls/12/reviews")
    expect(requestedUrl(fetcher).search).toBe("?per_page=100")
  })

  it("returns pull request comments", async () => {
    const fetcher = createFetcher([
      {
        id: 900,
        user: { login: "commenter" },
        body: "Please add tests",
        html_url: "https://github.com/agency/repository/issues/12#issuecomment-900",
        created_at: "2025-01-04T00:00:00+00:00"
      }
    ])
    const reader = createReader(fetcher)

    await expect(reader.execute(step("comments"), { query: { pullRequestNumber: 12 } })).resolves.toEqual({
      result: [
        {
          id: 900,
          user: { login: "commenter" },
          body: "Please add tests",
          html_url: "https://github.com/agency/repository/issues/12#issuecomment-900",
          created_at: "2025-01-04T00:00:00+00:00"
        }
      ]
    })

    expect(requestedUrl(fetcher).pathname).toBe("/repos/agency/repository/issues/12/comments")
    expect(requestedUrl(fetcher).search).toBe("?per_page=100")
  })

  it("fails closed for unsupported operation configuration", async () => {
    const reader = createReader(createFetcher({}))

    await expect(reader.execute(step("unknown_operation"), {})).rejects.toThrow("operation")
  })

  it("fails closed for additional repository configuration", async () => {
    const reader = createReader(createFetcher({}))
    const invalidStep = {
      ...step("metadata"),
      config: {
        operation: "metadata",
        repository: { owner: "agency", name: "repository", ref: "main" },
        token: "must-not-pass-through"
      }
    }

    await expect(reader.execute(invalidStep, {})).rejects.toThrow("Unrecognized key")
  })

  it("fails closed for invalid repository ref in configuration", async () => {
    const reader = createReader(createFetcher({}))
    const invalidStep = {
      ...step("metadata"),
      config: {
        operation: "metadata",
        repository: { owner: "agency", name: "repository", ref: " " }
      }
    }

    await expect(reader.execute(invalidStep, {})).rejects.toThrow("ref")
  })

  it("fails closed on provider errors", async () => {
    const reader = createReader(async () => response({ message: "Not Found" }, 404))
    await expect(reader.execute(step("metadata"), {})).rejects.toThrow("status 404: Not Found")
  })

  it("fails closed on provider errors without a message", async () => {
    const reader = createReader(async () => response({ reason: "not parseable" }, 500))

    await expect(reader.execute(step("metadata"), {})).rejects.toThrow("status 500: Unknown error")
  })
})
