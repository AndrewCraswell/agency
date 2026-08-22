import { describe, expect, it } from "vitest"
import {
  createCongressSynchronizationIdentity,
  createGovInfoSynchronizationIdentity,
  createOpenStatesSynchronizationIdentity,
  createSynchronizationDeduplicationKey,
  formatSynchronizationIdentity,
  parseSynchronizationEnvironment,
  parseSynchronizationIdentity,
  SynchronizationIdentityError,
  synchronizationQueueFor,
  synchronizationTaskIdentifierFor
} from "./identities.js"

describe("synchronization identities", () => {
  it("round-trips canonical Open States and Congress identities", () => {
    const openStates = createOpenStatesSynchronizationIdentity("bills", "ca")
    const congressBills = createCongressSynchronizationIdentity("bills")
    const congressEvents = createCongressSynchronizationIdentity("events", 119)
    const govInfo = createGovInfoSynchronizationIdentity(119)

    expect(formatSynchronizationIdentity(openStates)).toBe("openstates:bills:ca")
    expect(parseSynchronizationIdentity("openstates:bills:ca")).toEqual(openStates)
    expect(formatSynchronizationIdentity(congressBills)).toBe("congress:bills:current")
    expect(parseSynchronizationIdentity("congress:bills:current")).toEqual(congressBills)
    expect(formatSynchronizationIdentity(congressEvents)).toBe("congress:events:119")
    expect(parseSynchronizationIdentity("congress:events:119")).toEqual(congressEvents)
    expect(formatSynchronizationIdentity(govInfo)).toBe("govinfo:bill-status:119")
    expect(parseSynchronizationIdentity("govinfo:bill-status:119")).toEqual(govInfo)
  })

  it("derives stable provider queues, workers, and environment deduplication keys", () => {
    const openStates = createOpenStatesSynchronizationIdentity("entities", "tx")
    const congress = createCongressSynchronizationIdentity("house-votes", 119)
    const govInfo = createGovInfoSynchronizationIdentity(119)

    expect(synchronizationQueueFor(openStates)).toEqual({ concurrencyLimit: 3, name: "openstates" })
    expect(synchronizationTaskIdentifierFor(openStates)).toBe("openstates-entities-sync")
    expect(synchronizationQueueFor(congress)).toEqual({ concurrencyLimit: 4, name: "congress" })
    expect(synchronizationTaskIdentifierFor(congress)).toBe("congress-wave-coordinator")
    expect(createSynchronizationDeduplicationKey("staging", openStates)).toBe("staging:openstates:entities:tx")
    expect(synchronizationQueueFor(govInfo)).toEqual({ concurrencyLimit: 1, name: "govinfo" })
    expect(synchronizationTaskIdentifierFor(govInfo)).toBe("govinfo-bill-status-sync")
  })

  it("rejects malformed, unknown, multi-jurisdiction, and mismatched scopes", () => {
    for (const identity of [
      "openstates:bills",
      "openstates:bills:ca:tx",
      "openstates:bills:CA",
      "openstates:bills:ca,tx",
      "openstates:reports:ca",
      "congress:bills:119",
      "congress:events:current",
      "congress:events:0119",
      "congress:events:0",
      "govinfo:bills:119",
      "govinfo:bill-status:current",
      "legiscan:bills:ca"
    ]) {
      expect(() => parseSynchronizationIdentity(identity)).toThrow(SynchronizationIdentityError)
    }
  })

  it("rejects invalid direct constructor inputs", () => {
    expect(() => createCongressSynchronizationIdentity("bills", 119)).toThrow(SynchronizationIdentityError)
    expect(() => createCongressSynchronizationIdentity("events")).toThrow(SynchronizationIdentityError)
    expect(() => createCongressSynchronizationIdentity("events", 0)).toThrow(SynchronizationIdentityError)
    expect(() => parseSynchronizationEnvironment("preview")).toThrow(SynchronizationIdentityError)
  })
})
