import { describe, expect, it, vi } from "vitest"
import type { ProviderConnectionContext } from "./providerPorts"
import { createDefaultProviderTaskPortResolver, linearTaskReadProvider } from "./providerTaskAdapters"

const resource = { externalId: "team-1", name: "Agency" }
const task = {
  id: "issue-1",
  identifier: "AG-1",
  title: "Ship taskboard",
  description: null,
  url: "https://linear.app/agency/issue/AG-1",
  priority: 1,
  state: { id: "state-1", name: "Started", type: "started" },
  assignee: { id: "user-1", name: "Casey" },
  labels: { nodes: [{ id: "label-1", name: "backend" }] },
  createdAt: "2026-07-20T10:00:00.000Z",
  updatedAt: "2026-07-20T11:00:00.000Z"
}

function context(response: unknown): { context: ProviderConnectionContext; request: ReturnType<typeof vi.fn> } {
  const request = vi.fn(async () => response)
  return { context: { connectionId: "connection-1", provider: "linear", request }, request }
}

describe("linearTaskReadProvider", () => {
  it("registers the default Linear task provider", () => {
    expect(createDefaultProviderTaskPortResolver().resolve("linear")).toBe(linearTaskReadProvider)
  })

  it("lists normalized tasks with provider-side filters and an opaque next cursor", async () => {
    const values = context({
      data: {
        team: { issues: { nodes: [task], pageInfo: { hasNextPage: true, endCursor: "page-2" } } }
      }
    })

    const page = await linearTaskReadProvider.list(values.context, resource, {
      query: "ship",
      status: "started",
      assignee: "user-1",
      label: "label-1",
      pageSize: 25
    })

    expect(page).toMatchObject({
      items: [{ id: "issue-1", description: "", labels: [{ id: "label-1", name: "backend" }] }],
      previousCursor: null,
      nextCursor: expect.any(String)
    })
    expect(values.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          variables: expect.objectContaining({ teamId: "team-1", first: 25, after: null })
        })
      })
    )
    const secondValues = context({
      data: { team: { issues: { nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } } }
    })
    const secondPage = await linearTaskReadProvider.list(secondValues.context, resource, {
      cursor: page.nextCursor ?? undefined,
      pageSize: 25
    })
    expect(secondPage.previousCursor).toEqual(expect.any(String))
    expect(secondValues.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ variables: expect.objectContaining({ after: "page-2" }) })
      })
    )
  })

  it("returns normalized task details and comments for the selected team", async () => {
    const detailValues = context({ data: { issue: { ...task, team: { id: "team-1" } } } })
    await expect(linearTaskReadProvider.get(detailValues.context, resource, "issue-1")).resolves.toMatchObject({
      id: "issue-1",
      description: ""
    })

    const commentValues = context({
      data: {
        issue: {
          team: { id: "team-1" },
          comments: {
            nodes: [
              {
                id: "comment-1",
                body: "Ready",
                createdAt: "2026-07-20T12:00:00.000Z",
                user: { id: "user-1", name: "Casey" }
              }
            ]
          }
        }
      }
    })
    await expect(linearTaskReadProvider.comments(commentValues.context, resource, "issue-1")).resolves.toEqual([
      {
        id: "comment-1",
        body: "Ready",
        createdAt: "2026-07-20T12:00:00.000Z",
        author: { id: "user-1", name: "Casey" }
      }
    ])
  })

  it("rejects malformed cursors and tasks outside the selected team", async () => {
    const values = context({ data: { issue: { ...task, team: { id: "other-team" } } } })

    await expect(
      linearTaskReadProvider.list(values.context, resource, { cursor: "invalid", pageSize: 25 })
    ).rejects.toThrow("Task cursor is invalid")
    await expect(linearTaskReadProvider.get(values.context, resource, "issue-1")).rejects.toThrow(
      "Task does not belong to the selected resource"
    )
  })
})
