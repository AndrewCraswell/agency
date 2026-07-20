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

export interface ProviderResourcePort {
  readonly provider: string
  readonly resourceType: ProviderResourceType
  readonly capabilities: readonly IntegrationResourceCapability[]
  discover(context: ProviderConnectionContext): Promise<readonly DiscoveredProviderResource[]>
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
}
