import { describe, expect, it, vi } from "vitest"
import type { ProviderConnectionContext, ProviderResourcePort } from "./providerPorts"
import { ProviderPortResolver } from "./providerPorts"

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
})
