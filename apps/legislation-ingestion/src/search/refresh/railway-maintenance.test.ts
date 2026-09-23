import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createVerifiedRailwayMaintenance } from "./railway-maintenance.js"

const config = {
  project: "project",
  environment: "staging",
  services: [
    { id: "web", scale: ["us-west2=1"], endpoint: "https://web.example" },
    { id: "mcp", scale: ["us-west2=1"], endpoint: "https://mcp.example" }
  ]
}

function harness(
  options: {
    status?: number
    stopFails?: string
    restoreFails?: boolean
    restoreFailureService?: string
    hasMarker?: boolean
    hasWrongScope?: boolean
    hasWrongTopology?: boolean
    isStopIgnored?: boolean
    hasPendingDeployment?: boolean
    hasMarkerWriteFailure?: boolean
    responseBody?: string
    hasRunningReplica?: boolean
    canRestore?: boolean
    hasStoppedMcp?: boolean
  } = {}
) {
  const stopped = new Map([
    ["web", false],
    ["mcp", false]
  ])
  const markers: boolean[] = []
  const stoppedIds: string[] = []
  const restoredIds: string[] = []
  const run = vi.fn(async (args: readonly string[]) => {
    const document = args[1] ?? ""
    const variables = z
      .object({
        id: z.string().default(""),
        serviceId: z.string().default(""),
        input: z.object({ value: z.string() }).optional()
      })
      .parse(JSON.parse(args[3] ?? "{}"))
    if (document.includes("mutation Maintenance")) {
      if (options.hasMarkerWriteFailure) throw new Error("marker failure")
      markers.push(variables.input?.value === "true")
      return JSON.stringify({ data: { variableUpsert: true } })
    }
    if (document.includes("mutation Remove")) {
      stoppedIds.push(variables.id)
      if (variables.id === options.stopFails) throw new Error("stop failure")
      if (!options.isStopIgnored) stopped.set(variables.id, true)
      return JSON.stringify({ data: { deploymentRemove: true } })
    }
    if (document.includes("mutation Restore")) {
      if (options.restoreFails || variables.id === options.restoreFailureService) throw new Error("restore failure")
      restoredIds.push(variables.id)
      stopped.set(variables.id, false)
      return JSON.stringify({ data: { deploymentRedeploy: { id: variables.id } } })
    }
    const service = variables.serviceId
    const isStoppedMcp = options.hasStoppedMcp && service === "mcp" && stopped.get(service)
    const deployment = {
      id: service,
      environmentId: options.hasWrongScope ? "production" : "staging",
      serviceId: service,
      deploymentStopped: stopped.get(service),
      instances: [
        {
          id: `${service}-replica`,
          status: isStoppedMcp ? "EXITED" : stopped.get(service) && !options.hasRunningReplica ? "REMOVED" : "RUNNING"
        }
      ]
    }
    return JSON.stringify({
      data: {
        environment: {
          id: "staging",
          projectId: "project",
          config: {
            services: {
              [service]: {
                deploy: { multiRegionConfig: { "us-west2": { numReplicas: options.hasWrongTopology ? 2 : 1 } } }
              }
            }
          }
        },
        variables:
          options.hasMarker === false ? {} : { LEGISLATION_STAGING_REFRESH_MAINTENANCE: String(markers.at(-1)) },
        pendingDeployments: { edges: options.hasPendingDeployment ? [{ node: { id: "pending" } }] : [] },
        restorableDeployments: { edges: [{ node: { ...deployment, canRedeploy: options.canRestore ?? true } }] },
        serviceInstance: {
          serviceId: service,
          environmentId: "staging",
          latestDeployment:
            stopped.get(service) && !isStoppedMcp
              ? { ...deployment, id: `${service}-older`, deploymentStopped: true, instances: [] }
              : deployment,
          activeDeployments: stopped.get(service) && !options.hasRunningReplica && !isStoppedMcp ? [] : [deployment]
        }
      }
    })
  })
  const request = vi.fn(
    async (_url: URL, _init: RequestInit) =>
      new Response(options.responseBody ?? null, { status: options.status ?? 503 })
  )
  const sleep = vi.fn(async () => {})
  const controller = createVerifiedRailwayMaintenance(config, { run, request, sleep, attempts: 3, interval: 1 })
  return { controller, run, request, stopped, markers, stoppedIds, restoredIds }
}

describe("verified Railway maintenance", () => {
  it("persists the marker and verifies stopped deployments and two unavailable readiness probes", async () => {
    const test = harness()
    await test.controller.set(true)
    expect(test.markers).toEqual([true])
    expect(test.stoppedIds).toEqual(["web", "mcp"])
    expect(test.request).toHaveBeenCalledTimes(4)
    expect(test.request.mock.calls[0]?.[0]).toEqual(new URL("https://web.example/ready"))
    expect(test.run.mock.calls.some(([args]) => args.includes("us-west2=0"))).toBe(false)
  })

  it("reasserts maintenance after a deployment reopens a previously stopped service", async () => {
    const test = harness()
    await test.controller.set(true)
    test.stopped.set("web", false)
    await test.controller.set(true)
    expect(test.stoppedIds).toEqual(["web", "mcp", "web"])
    expect(test.markers).toEqual([true, true])
  })

  it("tries both services on a partial stop failure and never restores either", async () => {
    const test = harness({ stopFails: "web" })
    await expect(test.controller.set(true)).rejects.toThrow("Could not stop every staging service")
    expect(test.stoppedIds).toEqual(["web", "mcp"])
    expect(test.stopped.get("mcp")).toBe(true)
    expect(test.restoredIds).toEqual([])
    expect(test.markers).toEqual([true])
    await expect(test.controller.prepareValidation()).rejects.toThrow("must be unavailable")
    await expect(test.controller.set(false)).rejects.toThrow("before service validation")
  })

  it.each([200, 204, 301, 401, 403, 404, 500])(
    "refuses HTTP %i as evidence of service unavailability",
    async (status) => {
      const test = harness({ status })
      await expect(test.controller.set(true)).rejects.toThrow("could not be verified")
      expect(test.restoredIds).toEqual([])
    }
  )

  it("does not treat network or TLS errors as proof of maintenance", async () => {
    const test = harness()
    test.request.mockRejectedValue(new Error("TLS verification failed"))
    await expect(test.controller.set(true)).rejects.toThrow("could not be verified")
  })

  it("accepts Railway's application-not-found response only after runtime shutdown readback", async () => {
    const test = harness({
      status: 404,
      responseBody: JSON.stringify({
        status: "error",
        code: 404,
        message: "Application not found",
        request_id: "request"
      })
    })
    await test.controller.set(true)
    expect(test.request).toHaveBeenCalledTimes(4)
  })

  it("rejects inconsistent stopped readback when a replica remains RUNNING", async () => {
    const test = harness({ hasRunningReplica: true })
    await expect(test.controller.set(true)).rejects.toThrow("could not be verified")
  })

  it("does not start destructive work without a restorable deployment", async () => {
    const test = harness({ canRestore: false })
    await expect(test.controller.set(true)).rejects.toThrow("no deployment to restore")
  })

  it("rejects a successful stop command until running-instance readback confirms shutdown", async () => {
    const test = harness({ isStopIgnored: true })
    await expect(test.controller.set(true)).rejects.toThrow("could not be verified")
    expect(test.stoppedIds.length).toBeGreaterThan(2)
    expect(test.restoredIds).toEqual([])
  })

  it("refuses maintenance while an older build can still deploy after stopping the latest deployment", async () => {
    const test = harness({ hasPendingDeployment: true })
    await expect(test.controller.set(true)).rejects.toThrow("could not be verified")
    expect(test.restoredIds).toEqual([])
    expect([...test.stopped.values()]).toEqual([true, true])
  })

  it("never stops a deployment outside the explicitly selected scope", async () => {
    const test = harness({ hasWrongScope: true })
    await expect(test.controller.set(true)).rejects.toThrow("Could not stop every staging service")
    expect(test.stoppedIds).toEqual([])
  })

  it.each([{ hasMarker: false }, { hasMarkerWriteFailure: true }])(
    "stops both services but refuses destructive work when the marker is not verified: %j",
    async (options) => {
      const test = harness(options)
      await expect(test.controller.set(true)).rejects.toThrow()
      expect([...test.stopped.values()]).toEqual([true, true])
      await expect(test.controller.prepareValidation()).rejects.toThrow("must be unavailable")
    }
  )

  it("restores the original image, not the older latestDeployment returned after removal", async () => {
    const test = harness()
    await test.controller.set(true)
    await test.controller.prepareValidation()
    expect(test.restoredIds).toEqual(["web", "mcp"])
    expect(test.markers).toEqual([true, true])
    expect(test.run.mock.calls.some(([args]) => args[0] === "scale")).toBe(false)
    await test.controller.set(false)
    expect(test.markers).toEqual([true, true, false])
  })

  it("rediscovers restoration IDs after process restart with the marker enabled, W removed and M stopped", async () => {
    const test = harness({ hasStoppedMcp: true })
    test.markers.push(true)
    test.stopped.set("web", true)
    test.stopped.set("mcp", true)
    test.request.mockImplementation(async (url) =>
      url.hostname === "web.example"
        ? Response.json(
            { status: "error", code: 404, message: "Application not found", request_id: "request" },
            { status: 404 }
          )
        : new Response(null, { status: 502 })
    )
    const restarted = createVerifiedRailwayMaintenance(config, {
      run: test.run,
      request: test.request,
      sleep: vi.fn(async () => {}),
      attempts: 3,
      interval: 1
    })

    await expect(restarted.prepareValidation()).rejects.toThrow("must be unavailable")
    await restarted.set(true)
    expect(test.stoppedIds).toEqual([])
    expect(test.restoredIds).toEqual([])
    expect(test.request).toHaveBeenCalledTimes(4)

    await restarted.prepareValidation()
    expect(test.restoredIds).toEqual(["web", "mcp"])
    expect(test.stoppedIds).toEqual([])
    expect(test.markers).toEqual([true, true, true])
    expect(test.run.mock.calls.some(([args]) => args[0] === "scale")).toBe(false)
  })

  it.each([{ restoreFails: true }, { restoreFailureService: "mcp" }])(
    "reasserts shutdown after restoration failure: %j",
    async (options) => {
      const test = harness(options)
      await test.controller.set(true)
      await expect(test.controller.prepareValidation()).rejects.toThrow()
      expect([...test.stopped.values()]).toEqual([true, true])
      expect(test.markers).toEqual([true, true, true])
    }
  )

  it("rejects approved-topology mismatch before destructive work", async () => {
    const test = harness({ hasWrongTopology: true })
    await expect(test.controller.set(true)).rejects.toThrow("topology readback")
    expect([...test.stopped.values()]).toEqual([true, true])
  })

  it("rejects missing endpoints and invalid configuration without invoking Railway", () => {
    const test = harness()
    expect(() =>
      createVerifiedRailwayMaintenance(
        { ...config, services: [{ id: "web", scale: ["us-west2=1"], endpoint: "http://web.example" }] },
        { run: test.run }
      )
    ).toThrow("Invalid Railway maintenance service")
    expect(() => createVerifiedRailwayMaintenance({ ...config, services: [] }, { run: test.run })).toThrow(
      "Invalid Railway maintenance configuration"
    )
    expect(test.run).not.toHaveBeenCalled()
  })
})
