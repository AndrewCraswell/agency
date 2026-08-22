import { z } from "zod"
import { supportedOpenStatesJurisdictions } from "../ingestion/openstates/coverage.js"

export const synchronizationEnvironments = ["development", "staging", "production"] as const
export const synchronizationProviders = ["openstates", "congress", "govinfo"] as const
export const openStatesSynchronizationDomains = ["bills", "entities", "events"] as const
export const congressSynchronizationDomains = [
  "bills",
  "amendments",
  "entities",
  "events",
  "house-votes",
  "committee-reports"
] as const

const synchronizationEnvironmentSchema = z.enum(synchronizationEnvironments)
const openStatesSynchronizationDomainSchema = z.enum(openStatesSynchronizationDomains)
const congressSynchronizationDomainSchema = z.enum(congressSynchronizationDomains)
const openStatesJurisdictionSchema = z.enum(supportedOpenStatesJurisdictions)

export type SynchronizationEnvironment = z.infer<typeof synchronizationEnvironmentSchema>
export type SynchronizationProvider = (typeof synchronizationProviders)[number]
export type OpenStatesSynchronizationDomain = z.infer<typeof openStatesSynchronizationDomainSchema>
export type CongressSynchronizationDomain = z.infer<typeof congressSynchronizationDomainSchema>
export type OpenStatesJurisdiction = (typeof supportedOpenStatesJurisdictions)[number]
export type CongressScopedSynchronizationDomain = Exclude<CongressSynchronizationDomain, "bills">

export type GovInfoSynchronizationIdentity = Readonly<{
  domain: "bill-status"
  provider: "govinfo"
  scope: number
}>

export type OpenStatesSynchronizationIdentity = Readonly<{
  domain: OpenStatesSynchronizationDomain
  provider: "openstates"
  scope: OpenStatesJurisdiction
}>

export type CongressBillsSynchronizationIdentity = Readonly<{
  domain: "bills"
  provider: "congress"
  scope: "current"
}>

export type CongressScopedSynchronizationIdentity = Readonly<{
  domain: CongressScopedSynchronizationDomain
  provider: "congress"
  scope: number
}>

export type SynchronizationIdentity =
  | OpenStatesSynchronizationIdentity
  | CongressBillsSynchronizationIdentity
  | CongressScopedSynchronizationIdentity
  | GovInfoSynchronizationIdentity

export type SynchronizationTaskIdentifier =
  | "openstates-bills-sync"
  | "openstates-entities-sync"
  | "openstates-events-sync"
  | "congress-wave-coordinator"
  | "govinfo-bill-status-sync"

export type SynchronizationWorkerTaskIdentifier = Exclude<SynchronizationTaskIdentifier, "congress-wave-coordinator">

export type SynchronizationQueue = Readonly<{
  concurrencyLimit: number
  name: SynchronizationProvider
}>

export const synchronizationQueues = {
  // Migration-only queue for legacy direct Congress workers. Scheduled and
  // historical work is routed through congress-wave-coordinator instead.
  congress: { concurrencyLimit: 4, name: "congress" },
  govinfo: { concurrencyLimit: 1, name: "govinfo" },
  openstates: { concurrencyLimit: 3, name: "openstates" }
} as const satisfies Record<SynchronizationProvider, SynchronizationQueue>

const openStatesTaskIdentifiers = {
  bills: "openstates-bills-sync",
  entities: "openstates-entities-sync",
  events: "openstates-events-sync"
} as const satisfies Record<OpenStatesSynchronizationDomain, SynchronizationTaskIdentifier>

export class SynchronizationIdentityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SynchronizationIdentityError"
  }
}

export function parseSynchronizationEnvironment(value: unknown): SynchronizationEnvironment {
  const parsed = synchronizationEnvironmentSchema.safeParse(value)
  if (!parsed.success) {
    throw new SynchronizationIdentityError("Synchronization environment must be development, staging, or production")
  }
  return parsed.data
}

export function createOpenStatesSynchronizationIdentity(
  domain: OpenStatesSynchronizationDomain,
  scope: OpenStatesJurisdiction
): OpenStatesSynchronizationIdentity {
  return { domain, provider: "openstates", scope }
}

export function createCongressSynchronizationIdentity(
  domain: CongressSynchronizationDomain,
  congress?: number
): CongressBillsSynchronizationIdentity | CongressScopedSynchronizationIdentity {
  if (domain === "bills") {
    if (congress !== undefined) {
      throw new SynchronizationIdentityError("Congress bills must use the current scope")
    }
    return { domain, provider: "congress", scope: "current" }
  }

  if (congress === undefined || !Number.isSafeInteger(congress) || congress < 1) {
    throw new SynchronizationIdentityError("Congress synchronization scope must be a positive integer")
  }

  return { domain, provider: "congress", scope: congress }
}

export function createGovInfoSynchronizationIdentity(congress: number): GovInfoSynchronizationIdentity {
  if (!Number.isSafeInteger(congress) || congress < 1) {
    throw new SynchronizationIdentityError("GovInfo synchronization scope must be a positive integer")
  }
  return { domain: "bill-status", provider: "govinfo", scope: congress }
}

export function parseSynchronizationIdentity(value: unknown): SynchronizationIdentity {
  if (typeof value !== "string") {
    throw new SynchronizationIdentityError("Synchronization identity must be a string")
  }

  const parts = value.split(":")
  if (parts.length !== 3) {
    throw new SynchronizationIdentityError("Synchronization identity must contain provider, domain, and scope")
  }

  const [provider, domain, scope] = parts
  if (provider === undefined || domain === undefined || scope === undefined) {
    throw new SynchronizationIdentityError("Synchronization identity must contain provider, domain, and scope")
  }

  if (provider === "openstates") {
    const parsedDomain = openStatesSynchronizationDomainSchema.safeParse(domain)
    const parsedScope = openStatesJurisdictionSchema.safeParse(scope)
    if (!parsedDomain.success || !parsedScope.success) {
      throw new SynchronizationIdentityError("Open States identity must use a supported domain and one jurisdiction")
    }
    return createOpenStatesSynchronizationIdentity(parsedDomain.data, parsedScope.data)
  }

  if (provider === "govinfo") {
    if (domain !== "bill-status" || !/^[1-9]\d*$/.test(scope)) {
      throw new SynchronizationIdentityError("GovInfo identity must use bill-status and a positive Congress")
    }
    return createGovInfoSynchronizationIdentity(Number(scope))
  }

  if (provider !== "congress") {
    throw new SynchronizationIdentityError("Synchronization identity provider must be openstates, congress, or govinfo")
  }

  const parsedDomain = congressSynchronizationDomainSchema.safeParse(domain)
  if (!parsedDomain.success) {
    throw new SynchronizationIdentityError("Congress identity must use a supported domain")
  }

  if (parsedDomain.data === "bills") {
    if (scope !== "current") {
      throw new SynchronizationIdentityError("Congress bills must use the current scope")
    }
    return createCongressSynchronizationIdentity(parsedDomain.data)
  }

  if (!/^[1-9]\d*$/.test(scope)) {
    throw new SynchronizationIdentityError("Congress synchronization scope must be a positive integer")
  }

  return createCongressSynchronizationIdentity(parsedDomain.data, Number(scope))
}

export function formatSynchronizationIdentity(identity: SynchronizationIdentity): string {
  const value = `${identity.provider}:${identity.domain}:${identity.scope}`
  parseSynchronizationIdentity(value)
  return value
}

export function createSynchronizationDeduplicationKey(
  environment: SynchronizationEnvironment,
  identity: SynchronizationIdentity
): string {
  return `${parseSynchronizationEnvironment(environment)}:${formatSynchronizationIdentity(identity)}`
}

export function synchronizationQueueFor(identity: SynchronizationIdentity): SynchronizationQueue {
  return synchronizationQueues[identity.provider]
}

export function synchronizationTaskIdentifierFor(identity: SynchronizationIdentity): SynchronizationTaskIdentifier {
  if (identity.provider === "openstates") {
    return openStatesTaskIdentifiers[identity.domain]
  }
  if (identity.provider === "govinfo") {
    return "govinfo-bill-status-sync"
  }
  return "congress-wave-coordinator"
}
