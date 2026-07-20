import { describe, expect, it, vi } from "vitest"
import { createDefaultProviderPortResolver } from "./providerAdapters"
import type {
  ProviderConnectionContext,
  ProviderExecutionPort,
  ProviderResourcePort,
  ProviderTaskPort
} from "./providerPorts"
import { ProviderExecutionPortResolver, ProviderPortResolver, ProviderTaskPortResolver } from "./providerPorts"

function fixturePort(
  provider: string,
  resourceType: "repository" | "team",
  capability: "repository.read" | "team.read"
): ProviderResourcePort {
  return {
    provider,
    resourceType,
    capabilities: [capability],
    async discover(context) {
      await context.request({ method: "GET", endpoint: `/${resourceType}` })
      return [{ externalId: `${provider}-1`, name: `${provider} ${resourceType}` }]
    }
  }
}

function context(provider: string): ProviderConnectionContext {
  return {
    connectionId: `${provider}-connection`,
    provider,
    request: vi.fn(async () => ({}))
  }
}

describe("ProviderPortResolver", () => {
  it("resolves interchangeable repository and task adapters by provider capability", async () => {
    const repositoryA = fixturePort("repository-a", "repository", "repository.read")
    const repositoryB = fixturePort("repository-b", "repository", "repository.read")
    const taskA = fixturePort("task-a", "team", "team.read")
    const taskB = fixturePort("task-b", "team", "team.read")
    const resolver = new ProviderPortResolver([repositoryA, repositoryB, taskA, taskB])

    await expect(
      resolver.resolve("repository-a", "repository.read").discover(context("repository-a"))
    ).resolves.toEqual([{ externalId: "repository-a-1", name: "repository-a repository" }])
    await expect(
      resolver.resolve("repository-b", "repository.read").discover(context("repository-b"))
    ).resolves.toEqual([{ externalId: "repository-b-1", name: "repository-b repository" }])
    await expect(resolver.resolve("task-a", "team.read").discover(context("task-a"))).resolves.toEqual([
      { externalId: "task-a-1", name: "task-a team" }
    ])
    await expect(resolver.resolve("task-b", "team.read").discover(context("task-b"))).resolves.toEqual([
      { externalId: "task-b-1", name: "task-b team" }
    ])
  })

  it("rejects duplicate registrations and unsupported capabilities", () => {
    const port = fixturePort("repository-a", "repository", "repository.read")

    expect(() => new ProviderPortResolver([port, port])).toThrow("Duplicate provider port registration")
    const resolver = new ProviderPortResolver([port])
    expect(() => resolver.resolve("repository-a", "repository.write")).toThrow("Provider capability is not registered")
    expect(() => resolver.forProvider("missing")).toThrow("Provider is not registered")
    expect(resolver.capabilities("repository-a", "team")).toEqual([])
  })

  it("builds the event catalog from provider registrations", () => {
    const provider = fixturePort("fixture", "repository", "repository.read")
    const resolver = new ProviderPortResolver([
      { ...provider, events: [{ eventKey: "issue.created", label: "Issue created" }] }
    ])

    expect(resolver.eventDefinitions()).toEqual([
      {
        provider: "fixture",
        resourceType: "repository",
        eventKey: "issue.created",
        label: "Issue created"
      }
    ])
  })

  it("delegates webhook normalization to the registered provider", () => {
    const provider = fixturePort("fixture", "repository", "repository.read")
    const resolver = new ProviderPortResolver([
      {
        ...provider,
        normalizeEvent: (input) =>
          input.objectType === "Ticket"
            ? { eventKey: `ticket.${input.action}`, objectType: "ticket", objectId: input.objectId }
            : null
      }
    ])

    expect(
      resolver.normalizeEvent("fixture", {
        action: "created",
        objectType: "Ticket",
        objectId: "ticket-1",
        resourceId: "project-1"
      })
    ).toEqual({
      provider: "fixture",
      resourceType: "repository",
      resourceId: "project-1",
      eventKey: "ticket.created",
      objectType: "ticket",
      objectId: "ticket-1"
    })
  })

  it("normalizes GitHub issues and Linear lifecycle actions through their provider adapters", () => {
    const resolver = createDefaultProviderPortResolver()

    expect(
      resolver.normalizeEvent("github", {
        action: "opened",
        objectType: "Issue",
        objectId: "42",
        resourceId: "repository-1"
      })
    ).toMatchObject({ eventKey: "issue.created", resourceType: "repository", resourceId: "repository-1" })
    expect(
      resolver.normalizeEvent("linear", {
        action: "create",
        objectType: "Issue",
        objectId: "issue-1",
        resourceId: "team-1"
      })
    ).toMatchObject({ eventKey: "task.created", resourceType: "team", resourceId: "team-1" })
    expect(
      resolver.normalizeEvent("linear", {
        action: "remove",
        objectType: "Comment",
        objectId: "comment-1",
        resourceId: "team-1"
      })
    ).toMatchObject({ eventKey: "task.comment.removed", resourceType: "team", resourceId: "team-1" })
  })
})

describe("ProviderExecutionPortResolver", () => {
  it("resolves execution adapters by provider and resource type", () => {
    const port: ProviderExecutionPort = {
      provider: "fixture",
      resourceType: "repository",
      read: vi.fn(async () => ({ ok: true })),
      act: vi.fn(async () => ({ ok: true }))
    }
    const resolver = new ProviderExecutionPortResolver([port])

    expect(resolver.resolve("fixture", "repository")).toBe(port)
    expect(() => resolver.resolve("fixture", "team")).toThrow("Provider execution is not registered")
  })

  it("rejects duplicate provider and resource registrations", () => {
    const port: ProviderExecutionPort = {
      provider: "fixture",
      resourceType: "repository",
      read: vi.fn(async () => ({})),
      act: vi.fn(async () => ({}))
    }

    expect(() => new ProviderExecutionPortResolver([port, port])).toThrow(
      "Duplicate provider execution port registration"
    )
  })
})

describe("ProviderTaskPortResolver", () => {
  it("resolves interchangeable task adapters by provider", async () => {
    function taskPort(provider: string): ProviderTaskPort {
      return {
        provider,
        resourceType: "team",
        async list() {
          return { items: [], previousCursor: null, nextCursor: null }
        },
        async get() {
          return null
        },
        async comments() {
          return []
        }
      }
    }
    const taskA = taskPort("task-a")
    const taskB = taskPort("task-b")
    const resolver = new ProviderTaskPortResolver([taskA, taskB])

    await expect(
      resolver.resolve("task-a").list(context("task-a"), { externalId: "team-a", name: "Team A" }, { pageSize: 25 })
    ).resolves.toEqual({ items: [], previousCursor: null, nextCursor: null })
    expect(resolver.resolve("task-b")).toBe(taskB)
    expect(() => resolver.resolve("missing")).toThrow("Task provider is not registered")
  })

  it("rejects duplicate task providers", () => {
    const port: ProviderTaskPort = {
      provider: "task-a",
      resourceType: "team",
      async list() {
        return { items: [], previousCursor: null, nextCursor: null }
      },
      async get() {
        return null
      },
      async comments() {
        return []
      }
    }

    expect(() => new ProviderTaskPortResolver([port, port])).toThrow("Duplicate task provider port registration")
  })
})
