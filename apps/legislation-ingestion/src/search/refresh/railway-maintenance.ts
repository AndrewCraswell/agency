import { setTimeout } from "node:timers/promises"
import { z } from "zod"

const maintenanceVariable = "LEGISLATION_STAGING_REFRESH_MAINTENANCE"
const deploymentSchema = z.object({
  id: z.string().min(1),
  environmentId: z.string(),
  serviceId: z.string(),
  deploymentStopped: z.boolean(),
  instances: z.array(z.object({ id: z.string(), status: z.string() }))
})
function isStopped(deployment: z.infer<typeof deploymentSchema>) {
  return (
    deployment.deploymentStopped &&
    deployment.instances.every((instance) => ["EXITED", "REMOVED", "STOPPED"].includes(instance.status))
  )
}
const stateSchema = z.object({
  environment: z.object({
    id: z.string(),
    projectId: z.string(),
    config: z.object({
      services: z.record(z.string(), z.unknown())
    })
  }),
  variables: z.record(z.string(), z.unknown()),
  pendingDeployments: z.object({ edges: z.array(z.object({ node: z.object({ id: z.string() }) })) }),
  restorableDeployments: z.object({
    edges: z.array(z.object({ node: deploymentSchema.extend({ canRedeploy: z.boolean() }) }))
  }),
  serviceInstance: z.object({
    environmentId: z.string(),
    serviceId: z.string(),
    latestDeployment: deploymentSchema.nullable(),
    activeDeployments: z.array(deploymentSchema)
  })
})

export type RailwayMaintenanceConfig = {
  project: string
  environment: string
  services: readonly { id: string; scale: readonly string[]; endpoint: string }[]
}

type Dependencies = {
  run: (arguments_: readonly string[]) => Promise<string>
  request: (url: URL, init: RequestInit) => Promise<Response>
  sleep: (milliseconds: number) => Promise<unknown>
  attempts: number
  interval: number
}

export function createVerifiedRailwayMaintenance(
  config: RailwayMaintenanceConfig,
  dependencies: Pick<Dependencies, "run"> & Partial<Omit<Dependencies, "run">>
) {
  const { run, request = fetch, sleep = setTimeout, attempts = 60, interval = 2_000 } = dependencies
  if (
    !config.project ||
    !config.environment ||
    !config.services.length ||
    new Set(config.services.map(({ id }) => id)).size !== config.services.length ||
    !Number.isSafeInteger(attempts) ||
    attempts < 2
  ) {
    throw new Error("Invalid Railway maintenance configuration")
  }
  const services = config.services.map((service) => {
    const endpoint = new URL(service.endpoint)
    if (
      !service.id ||
      endpoint.protocol !== "https:" ||
      endpoint.username ||
      endpoint.password ||
      !service.scale.length ||
      service.scale.some((entry) => !/^[a-z0-9-]+=[1-9][0-9]*$/.test(entry))
    ) {
      throw new Error("Invalid Railway maintenance service")
    }
    return { ...service, ready: new URL("/ready", endpoint) }
  })
  let hasVerifiedMaintenance = false
  let hasPreparedValidation = false
  const restorationIds = new Map<string, string>()

  async function api(document: string, variables: Record<string, unknown>) {
    const output: unknown = JSON.parse(
      await run(["api", document, "--variables", JSON.stringify(variables), "--compact"])
    )
    const response = z.object({ data: z.unknown(), errors: z.array(z.unknown()).optional() }).parse(output)
    if (response.errors?.length) throw new Error("Railway maintenance API returned errors")
    return response.data
  }

  async function marker(isEnabled: boolean) {
    const result = await api(`mutation Maintenance($input: VariableUpsertInput!) { variableUpsert(input: $input) }`, {
      input: {
        projectId: config.project,
        environmentId: config.environment,
        name: maintenanceVariable,
        value: String(isEnabled),
        skipDeploys: true
      }
    })
    z.object({ variableUpsert: z.literal(true) }).parse(result)
  }

  async function state(serviceId: string, isMaintenanceEnabled: boolean | null = true) {
    const result = stateSchema.parse(
      await api(
        `query Maintenance($projectId: String!, $environmentId: String!, $serviceId: String!) {
          environment(id: $environmentId, projectId: $projectId) { id projectId config(decryptVariables: false) }
          variables(projectId: $projectId, environmentId: $environmentId)
          pendingDeployments: deployments(first: 1, input: {
            projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId,
            status: { in: [WAITING, NEEDS_APPROVAL, QUEUED, INITIALIZING, BUILDING, DEPLOYING] }
          }) { edges { node { id } } }
          restorableDeployments: deployments(first: 1, input: {
            projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId,
            includeDeleted: true, status: { in: [SUCCESS, REMOVED] }
          }) { edges { node { id environmentId serviceId deploymentStopped canRedeploy instances { id status } } } }
          serviceInstance(environmentId: $environmentId, serviceId: $serviceId) {
            environmentId serviceId
            latestDeployment { id environmentId serviceId deploymentStopped instances { id status } }
            activeDeployments { id environmentId serviceId deploymentStopped instances { id status } }
          }
        }`,
        { projectId: config.project, environmentId: config.environment, serviceId }
      )
    )
    const instance = result.serviceInstance
    const deployments = [
      ...instance.activeDeployments,
      ...(instance.latestDeployment ? [instance.latestDeployment] : [])
    ]
    if (
      result.environment.id !== config.environment ||
      result.environment.projectId !== config.project ||
      instance.environmentId !== config.environment ||
      instance.serviceId !== serviceId ||
      [...deployments, ...result.restorableDeployments.edges.map(({ node }) => node)].some(
        (deployment) => deployment.environmentId !== config.environment || deployment.serviceId !== serviceId
      )
    ) {
      throw new Error("Railway maintenance readback returned the wrong scope")
    }
    if (isMaintenanceEnabled !== null && result.variables[maintenanceVariable] !== String(isMaintenanceEnabled)) {
      throw new Error("Railway maintenance marker readback does not match the requested state")
    }
    const serviceConfig = z
      .object({
        deploy: z
          .object({
            multiRegionConfig: z
              .record(z.string(), z.object({ numReplicas: z.number().int().nonnegative() }).nullable())
              .optional()
          })
          .optional()
      })
      .parse(result.environment.config.services[serviceId])
    return {
      instance,
      hasPendingDeployment: result.pendingDeployments.edges.length !== 0,
      restorableDeployment: result.restorableDeployments.edges[0]?.node,
      topology: serviceConfig.deploy?.multiRegionConfig,
      deployments: [...new Map(deployments.map((item) => [item.id, item])).values()]
    }
  }

  async function stop(serviceId: string) {
    const current = await state(serviceId, null)
    if (!restorationIds.has(serviceId) && current.restorableDeployment?.canRedeploy) {
      restorationIds.set(serviceId, current.restorableDeployment.id)
    }
    for (const deployment of current.deployments) {
      if (isStopped(deployment)) continue
      // Stop can return success while a replica remains RUNNING. Removal stops routing and the deployment.
      const result = await api(`mutation Remove($id: String!) { deploymentRemove(id: $id) }`, {
        id: deployment.id
      })
      z.object({ deploymentRemove: z.literal(true) }).parse(result)
    }
  }

  function assertTopology(service: (typeof services)[number], current: Awaited<ReturnType<typeof state>>) {
    const actual = Object.entries(current.topology ?? {})
      .filter(([, region]) => region !== null && region.numReplicas > 0)
      .map(([region, replicas]) => `${region}=${replicas?.numReplicas}`)
      .sort()
    if (JSON.stringify(actual) !== JSON.stringify([...service.scale].sort())) {
      throw new Error("Railway topology readback does not match the approved region IDs")
    }
  }

  async function unavailable(ready: URL) {
    try {
      const response = await request(ready, {
        redirect: "manual",
        cache: "no-store",
        headers: { "cache-control": "no-cache, no-store" },
        signal: AbortSignal.timeout(5_000)
      })
      if (response.status === 404) {
        const body: unknown = await response.json()
        return z
          .object({
            status: z.literal("error"),
            code: z.literal(404),
            message: z.literal("Application not found"),
            request_id: z.string().min(1)
          })
          .safeParse(body).success
      }
      await response.body?.cancel()
      // Authentication failures, redirects and probe network failures do not prove maintenance.
      return response.status === 502 || response.status === 503
    } catch {
      return false
    }
  }

  async function enterMaintenance() {
    hasVerifiedMaintenance = false
    hasPreparedValidation = false
    const marked = await Promise.allSettled([marker(true)])
    // A service failure must not prevent the other service from being stopped.
    const stopped = await Promise.allSettled(services.map((service) => stop(service.id)))
    if ([...marked, ...stopped].some((result) => result.status === "rejected")) {
      throw new Error("Could not stop every staging service or persist maintenance; maintenance was not released")
    }
    let confirmations = 0
    for (let attempt = 0; attempt < attempts; attempt++) {
      let areServicesStopped = true
      for (const service of services) {
        const current = await state(service.id)
        assertTopology(service, current)
        if (!restorationIds.has(service.id)) throw new Error("Staging service has no deployment to restore")
        if (current.hasPendingDeployment) areServicesStopped = false
        if (current.deployments.some((deployment) => !isStopped(deployment))) {
          areServicesStopped = false
          await stop(service.id)
        }
        if (!(await unavailable(service.ready))) areServicesStopped = false
      }
      confirmations = areServicesStopped ? confirmations + 1 : 0
      if (confirmations >= 2) {
        hasVerifiedMaintenance = true
        return
      }
      if (attempt + 1 < attempts) await sleep(interval)
    }
    throw new Error("Staging service shutdown or readiness unavailability could not be verified")
  }

  return {
    async set(isUnavailable: boolean) {
      if (isUnavailable) {
        await enterMaintenance()
        return
      }
      if (!hasPreparedValidation) {
        throw new Error("Staging cannot leave maintenance before service validation")
      }
      await marker(false)
      await Promise.all(services.map((service) => state(service.id, false)))
      hasPreparedValidation = false
    },
    async prepareValidation() {
      if (!hasVerifiedMaintenance) throw new Error("Staging must be unavailable before service validation")
      await enterMaintenance()
      try {
        for (const service of services) {
          const current = await state(service.id)
          assertTopology(service, current)
          const deploymentId = restorationIds.get(service.id)
          if (!deploymentId) throw new Error("Staging service has no deployment to restore")
          const result = await api(
            `mutation Restore($id: String!) {
              deploymentRedeploy(id: $id, usePreviousImageTag: true) { id }
            }`,
            { id: deploymentId }
          )
          z.object({ deploymentRedeploy: z.object({ id: z.string().min(1) }) }).parse(result)
        }
        hasVerifiedMaintenance = false
        hasPreparedValidation = true
      } catch (error) {
        await enterMaintenance()
        throw error
      }
    }
  }
}
