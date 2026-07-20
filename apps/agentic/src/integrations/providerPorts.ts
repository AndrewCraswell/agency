import type { IntegrationResourceCapability } from "./contracts"

export type ProviderTransportRequest = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  endpoint: string
  headers?: Record<string, string>
  params?: Record<string, string | number>
  data?: unknown
  baseUrlOverride?: string
}

export type ProviderConnectionContext = {
  connectionId: string
  provider: string
  request(request: ProviderTransportRequest): Promise<unknown>
}

export type DiscoveredProviderResource = {
  externalId: string
  name: string
}

export type ProviderResourceType = "repository" | "team"

export type ProviderEventDefinition = {
  eventKey: string
  label: string
}

export type ResolvedProviderEventDefinition = ProviderEventDefinition & {
  provider: string
  resourceType: ProviderResourceType
}

export type ProviderWebhookEventInput = {
  action: string
  objectType: string
  objectId?: string
  resourceId: string
}

export type NormalizedProviderEvent<Provider extends string = string> = {
  provider: Provider
  resourceType: ProviderResourceType
  resourceId: string
  eventKey: string
  objectType: string
  objectId?: string
}

export type ProviderTask = {
  id: string
  identifier: string
  title: string
  description: string
  url: string
  priority: number
  state: { id: string; name: string; type: string }
  assignee: { id: string; name: string } | null
  labels: readonly { id: string; name: string }[]
  createdAt: string
  updatedAt: string
}

export type ProviderTaskComment = {
  id: string
  body: string
  createdAt: string
  author: { id: string; name: string } | null
}

export type ProviderTaskQuery = {
  query?: string
  status?: string
  assignee?: string
  label?: string
  cursor?: string
  pageSize: number
}

export type ProviderTaskPage = {
  items: readonly ProviderTask[]
  previousCursor: string | null
  nextCursor: string | null
}

export interface ProviderTaskPort {
  readonly provider: string
  readonly resourceType: "team"
  list(
    context: ProviderConnectionContext,
    resource: DiscoveredProviderResource,
    query: ProviderTaskQuery
  ): Promise<ProviderTaskPage>
  get(
    context: ProviderConnectionContext,
    resource: DiscoveredProviderResource,
    taskId: string
  ): Promise<ProviderTask | null>
  comments(
    context: ProviderConnectionContext,
    resource: DiscoveredProviderResource,
    taskId: string
  ): Promise<readonly ProviderTaskComment[]>
}

export interface ProviderResourcePort {
  readonly provider: string
  readonly resourceType: ProviderResourceType
  readonly capabilities: readonly IntegrationResourceCapability[]
  readonly events?: readonly ProviderEventDefinition[]
  normalizeEvent?(input: ProviderWebhookEventInput): { eventKey: string; objectType: string; objectId?: string } | null
  discover(context: ProviderConnectionContext): Promise<readonly DiscoveredProviderResource[]>
}

export interface ProviderExecutionPort {
  readonly provider: string
  readonly resourceType: ProviderResourceType
  read(
    context: ProviderConnectionContext,
    operation: string,
    resource: DiscoveredProviderResource,
    query: Record<string, unknown>
  ): Promise<unknown>
  act(
    context: ProviderConnectionContext,
    operation: string,
    resource: DiscoveredProviderResource,
    request: Record<string, unknown>
  ): Promise<unknown>
}

export class ProviderExecutionPortResolver {
  readonly #ports: readonly ProviderExecutionPort[]

  constructor(ports: readonly ProviderExecutionPort[]) {
    const registrations = new Set<string>()
    for (const port of ports) {
      const key = `${port.provider}:${port.resourceType}`
      if (registrations.has(key)) {
        throw new Error(`Duplicate provider execution port registration: ${key}`)
      }
      registrations.add(key)
    }
    this.#ports = [...ports]
  }

  resolve(provider: string, resourceType: ProviderResourceType): ProviderExecutionPort {
    const port = this.#ports.find(
      (candidate) => candidate.provider === provider && candidate.resourceType === resourceType
    )
    if (port === undefined) {
      throw new Error(`Provider execution is not registered: ${provider}:${resourceType}`)
    }
    return port
  }
}

export class ProviderTaskPortResolver {
  readonly #ports: readonly ProviderTaskPort[]

  constructor(ports: readonly ProviderTaskPort[]) {
    const providers = new Set<string>()
    for (const port of ports) {
      if (providers.has(port.provider)) {
        throw new Error(`Duplicate task provider port registration: ${port.provider}`)
      }
      providers.add(port.provider)
    }
    this.#ports = [...ports]
  }

  resolve(provider: string): ProviderTaskPort {
    const port = this.#ports.find((candidate) => candidate.provider === provider)
    if (port === undefined) {
      throw new Error(`Task provider is not registered: ${provider}`)
    }
    return port
  }
}

export class ProviderPortResolver {
  readonly #ports: readonly ProviderResourcePort[]

  constructor(ports: readonly ProviderResourcePort[]) {
    const registrations = new Set<string>()
    for (const port of ports) {
      const key = `${port.provider}:${port.resourceType}`
      if (registrations.has(key)) {
        throw new Error(`Duplicate provider port registration: ${key}`)
      }
      registrations.add(key)
    }
    this.#ports = [...ports]
  }

  resolve(provider: string, capability: IntegrationResourceCapability): ProviderResourcePort {
    const port = this.#ports.find(
      (candidate) => candidate.provider === provider && candidate.capabilities.includes(capability)
    )
    if (port === undefined) {
      throw new Error(`Provider capability is not registered: ${provider}:${capability}`)
    }
    return port
  }

  forProvider(provider: string): readonly ProviderResourcePort[] {
    const ports = this.#ports.filter((port) => port.provider === provider)
    if (ports.length === 0) {
      throw new Error(`Provider is not registered: ${provider}`)
    }
    return ports
  }

  capabilities(provider: string, resourceType: ProviderResourceType): readonly IntegrationResourceCapability[] {
    const port = this.#ports.find(
      (candidate) => candidate.provider === provider && candidate.resourceType === resourceType
    )
    return port?.capabilities ?? []
  }

  eventDefinitions(): readonly ResolvedProviderEventDefinition[] {
    return this.#ports.flatMap((port) =>
      (port.events ?? []).map((event) => ({
        provider: port.provider,
        resourceType: port.resourceType,
        ...event
      }))
    )
  }

  normalizeEvent<Provider extends string>(
    provider: Provider,
    input: ProviderWebhookEventInput
  ): NormalizedProviderEvent<Provider> | null {
    for (const port of this.#ports.filter((candidate) => candidate.provider === provider)) {
      const event = port.normalizeEvent?.(input)
      if (event !== undefined && event !== null) {
        return {
          provider,
          resourceType: port.resourceType,
          resourceId: input.resourceId,
          ...event
        }
      }
    }
    return null
  }
}
