import { supportedOpenStatesJurisdictions } from "../ingestion/openstates/coverage.js"
import {
  createCongressSynchronizationIdentity,
  createGovInfoSynchronizationIdentity,
  createOpenStatesSynchronizationIdentity,
  createSynchronizationDeduplicationKey,
  formatSynchronizationIdentity,
  parseSynchronizationEnvironment,
  parseSynchronizationIdentity,
  synchronizationQueueFor,
  synchronizationTaskIdentifierFor,
  type SynchronizationEnvironment,
  type SynchronizationIdentity,
  type SynchronizationQueue,
  type SynchronizationTaskIdentifier
} from "./identities.js"

export const scheduleDispatcherTaskIdentifier = "schedule-dispatcher" as const
export const defaultCurrentCongress = 119

export type SynchronizationScheduleManifestOptions = Readonly<{
  /** Enables the singleton Congress wave ingress and GovInfo schedules. */
  active?: boolean
  currentCongress?: number
  environment?: SynchronizationEnvironment
  /**
   * Enables OpenStates schedules only when the caller has explicitly opted in.
   * This is intentionally independent from the standard provider activation.
   */
  openStatesActiveJurisdictions?: readonly (typeof supportedOpenStatesJurisdictions)[number][]
}>

export type SynchronizationScheduleManifestEntry = Readonly<{
  active: boolean
  cron: string
  deduplicationKey: string
  externalId: string
  identity: SynchronizationIdentity
  managed: true
  queue: SynchronizationQueue
  taskIdentifier: typeof scheduleDispatcherTaskIdentifier
  timezone: "UTC"
  workerTaskIdentifier: SynchronizationTaskIdentifier
}>

export class SynchronizationScheduleManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SynchronizationScheduleManifestError"
  }
}

export function createSynchronizationScheduleManifest(
  options: SynchronizationScheduleManifestOptions = {}
): readonly SynchronizationScheduleManifestEntry[] {
  const resolvedOptions = resolveManifestOptions(options)
  const manifest = buildSynchronizationScheduleManifest(resolvedOptions)
  validateSynchronizationScheduleManifest(manifest, resolvedOptions)
  return manifest
}

export function parseManagedSynchronizationIdentity(
  value: unknown,
  manifest: readonly SynchronizationScheduleManifestEntry[]
): SynchronizationIdentity {
  const identity = parseSynchronizationIdentity(value)
  const externalId = formatSynchronizationIdentity(identity)
  if (!manifest.some((schedule) => schedule.externalId === externalId)) {
    throw new SynchronizationScheduleManifestError(
      `Synchronization identity is not managed by this schedule manifest: ${externalId}`
    )
  }
  return identity
}

export function validateSynchronizationScheduleManifest(
  manifest: readonly SynchronizationScheduleManifestEntry[],
  options: SynchronizationScheduleManifestOptions = {}
): void {
  const resolvedOptions = resolveManifestOptions(options)
  const expectedManifest = buildSynchronizationScheduleManifest(resolvedOptions)
  if (manifest.length !== expectedManifest.length) {
    throw new SynchronizationScheduleManifestError(
      `Expected ${expectedManifest.length} synchronization schedules, received ${manifest.length}`
    )
  }

  const actualByExternalId = new Map<string, SynchronizationScheduleManifestEntry>()
  for (const schedule of manifest) {
    if (actualByExternalId.has(schedule.externalId)) {
      throw new SynchronizationScheduleManifestError(`Duplicate schedule external ID: ${schedule.externalId}`)
    }
    actualByExternalId.set(schedule.externalId, schedule)
  }

  for (const expected of expectedManifest) {
    const actual = actualByExternalId.get(expected.externalId)
    if (actual === undefined) {
      throw new SynchronizationScheduleManifestError(`Missing managed schedule: ${expected.externalId}`)
    }
    validateScheduleEntry(actual, expected)
  }
}

function resolveManifestOptions(
  options: SynchronizationScheduleManifestOptions
): Required<SynchronizationScheduleManifestOptions> {
  return {
    active: options.active ?? false,
    currentCongress: options.currentCongress ?? defaultCurrentCongress,
    environment: parseSynchronizationEnvironment(options.environment ?? "development"),
    openStatesActiveJurisdictions: options.active === true ? [...(options.openStatesActiveJurisdictions ?? [])] : []
  }
}

function buildSynchronizationScheduleManifest(
  options: Required<SynchronizationScheduleManifestOptions>
): SynchronizationScheduleManifestEntry[] {
  const schedules: SynchronizationScheduleManifestEntry[] = []

  const activeOpenStatesJurisdictions = new Set(options.openStatesActiveJurisdictions)
  for (const [index, jurisdiction] of supportedOpenStatesJurisdictions.entries()) {
    schedules.push(
      createSchedule(
        createOpenStatesSynchronizationIdentity("bills", jurisdiction),
        openStatesBillsCron(index),
        options.environment,
        activeOpenStatesJurisdictions.has(jurisdiction)
      )
    )
    schedules.push(
      createSchedule(
        createOpenStatesSynchronizationIdentity("entities", jurisdiction),
        openStatesEntitiesCron(index),
        options.environment,
        activeOpenStatesJurisdictions.has(jurisdiction)
      )
    )
    schedules.push(
      createSchedule(
        createOpenStatesSynchronizationIdentity("events", jurisdiction),
        openStatesEventsCron(index),
        options.environment,
        activeOpenStatesJurisdictions.has(jurisdiction)
      )
    )
  }

  schedules.push(
    createSchedule(createCongressSynchronizationIdentity("bills"), "0 * * * *", options.environment, options.active)
  )
  schedules.push(
    createSchedule(
      createCongressSynchronizationIdentity("amendments", options.currentCongress),
      "5 * * * *",
      options.environment,
      false
    )
  )
  schedules.push(
    createSchedule(
      createCongressSynchronizationIdentity("events", options.currentCongress),
      "20 * * * *",
      options.environment,
      false
    )
  )
  schedules.push(
    createSchedule(
      createCongressSynchronizationIdentity("house-votes", options.currentCongress),
      "35 * * * *",
      options.environment,
      false
    )
  )
  schedules.push(
    createSchedule(
      createCongressSynchronizationIdentity("committee-reports", options.currentCongress),
      "50 */6 * * *",
      options.environment,
      false
    )
  )
  schedules.push(
    createSchedule(
      createCongressSynchronizationIdentity("entities", options.currentCongress),
      "10 3 * * *",
      options.environment,
      false
    )
  )

  schedules.push(
    createSchedule(
      createGovInfoSynchronizationIdentity(options.currentCongress),
      "45 11 * * *",
      options.environment,
      options.active
    )
  )

  return schedules
}

function createSchedule(
  identity: SynchronizationIdentity,
  cron: string,
  environment: SynchronizationEnvironment,
  active: boolean,
  timezone: SynchronizationScheduleManifestEntry["timezone"] = "UTC"
): SynchronizationScheduleManifestEntry {
  const externalId = formatSynchronizationIdentity(identity)
  return {
    active,
    cron,
    deduplicationKey: createSynchronizationDeduplicationKey(environment, identity),
    externalId,
    identity,
    managed: true,
    queue: synchronizationQueueFor(identity),
    taskIdentifier: scheduleDispatcherTaskIdentifier,
    timezone,
    workerTaskIdentifier: synchronizationTaskIdentifierFor(identity)
  }
}

function validateScheduleEntry(
  actual: SynchronizationScheduleManifestEntry,
  expected: SynchronizationScheduleManifestEntry
): void {
  const externalId = formatSynchronizationIdentity(actual.identity)
  if (actual.externalId !== externalId) {
    throw new SynchronizationScheduleManifestError(
      `Schedule external ID does not match its identity: ${actual.externalId}`
    )
  }
  if (actual.cron !== expected.cron) {
    throw new SynchronizationScheduleManifestError(`Schedule cron does not match its identity: ${actual.externalId}`)
  }
  if (actual.deduplicationKey !== expected.deduplicationKey) {
    throw new SynchronizationScheduleManifestError(
      `Schedule deduplication key does not match its identity: ${actual.externalId}`
    )
  }
  if (actual.managed !== true || actual.active !== expected.active || actual.timezone !== expected.timezone) {
    throw new SynchronizationScheduleManifestError(`Schedule management state is invalid: ${actual.externalId}`)
  }
  if (actual.taskIdentifier !== expected.taskIdentifier) {
    throw new SynchronizationScheduleManifestError(
      `Schedule dispatcher target does not match its identity: ${actual.externalId}`
    )
  }
  if (actual.workerTaskIdentifier !== expected.workerTaskIdentifier) {
    throw new SynchronizationScheduleManifestError(
      `Schedule worker routing does not match its identity: ${actual.externalId}`
    )
  }
  if (actual.queue.name !== expected.queue.name || actual.queue.concurrencyLimit !== expected.queue.concurrencyLimit) {
    throw new SynchronizationScheduleManifestError(`Schedule queue does not match its identity: ${actual.externalId}`)
  }
}

function openStatesBillsCron(index: number): string {
  const phase = index % 30
  return `${phase},${phase + 30} * * * *`
}

function openStatesEntitiesCron(index: number): string {
  const minutesAfterFiveUtc = index * 2
  const minute = minutesAfterFiveUtc % 60
  const hour = 5 + Math.floor(minutesAfterFiveUtc / 60)
  return `${minute} ${hour} * * *`
}

function openStatesEventsCron(index: number): string {
  const phase = index % 30
  return `${(phase + 10) % 30} */2 * * *`
}
