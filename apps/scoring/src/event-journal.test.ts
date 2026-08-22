import { describe, expect, it } from "vitest"
import { DECISION_RECORD_SCHEMA_VERSION, type DecisionRecord } from "./decision-record.js"
import {
  EVENT_JOURNAL_WRITE_BOUNDARIES,
  VirtualJournalPowerLoss,
  createEventJournal,
  createVirtualEventJournalStorage
} from "./event-journal.js"

const provenance = {
  calibrationProfileRevision: "calibration-1",
  firmware: {
    buildDigest: `sha256:${"8f".repeat(32)}`,
    identity: "stm32-scoring",
    scoringBootId: "boot-stm32-1"
  },
  hardwareRevision: "evt-a",
  lineContractRevision: "lines-1",
  ruleSetRevision: "rules-1",
  timingTableRevision: "timing-1"
} as const

function record(recordId: string, atUs: number): DecisionRecord {
  return {
    captureWindow: { firstSequence: atUs, fromUs: atUs, lastSequence: atUs, throughUs: atUs },
    decisionAtUs: atUs,
    outcome: {
      disposition: "qualified-hit",
      hitStartedAtUs: atUs,
      qualifiedAtUs: atUs,
      side: "left",
      signal: { audible: "requested", latched: true, visual: "valid-hit" },
      weapon: "epee"
    },
    provenance,
    rawCaptureRefs: [
      {
        captureId: `capture-${recordId}`,
        contentDigest: `sha256:${"ab".repeat(32)}`,
        contentFormatRevision: "capture-1",
        firstSequence: atUs,
        fromUs: atUs,
        kind: "acquisition-samples",
        lastSequence: atUs,
        sampleCount: 1,
        throughUs: atUs
      }
    ],
    recordId,
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION
  }
}

describe("event journal", () => {
  it("commits immutable authoritative records and recovers them after boot", () => {
    const storage = createVirtualEventJournalStorage()
    const source = record("record-1", 100)
    const journal = createEventJournal({ storage })

    expect(journal.recovery).toEqual({ reason: null, status: "empty" })
    expect(journal.append(source)).toMatchObject({ outcome: "accepted", record: { recordId: "record-1" } })

    expect(journal.records).toHaveLength(1)
    expect(journal.records[0]!.outcome).toMatchObject({ side: "left" })
    expect(Object.isFrozen(journal.records[0])).toBe(true)
    expect(Object.isFrozen(journal.records[0]!.rawCaptureRefs)).toBe(true)
    expect(createEventJournal({ storage }).recovery).toEqual({ reason: null, status: "recovered" })
    expect(createEventJournal({ storage }).records.map((entry) => entry.recordId)).toEqual(["record-1"])
  })

  it("recovers either the old or new complete checkpoint after every write boundary", () => {
    for (const boundary of EVENT_JOURNAL_WRITE_BOUNDARIES) {
      const storage = createVirtualEventJournalStorage()
      const first = createEventJournal({ storage })
      first.append(record("record-old", 100))
      storage.armPowerLoss(boundary)

      expect(() => first.append(record("record-new", 200))).toThrow(VirtualJournalPowerLoss)
      const rebooted = createEventJournal({ storage })
      const expected = boundary === "commit-marker" ? ["record-old", "record-new"] : ["record-old"]
      expect(rebooted.records.map((entry) => entry.recordId)).toEqual(expected)
      expect(rebooted.recovery).toEqual({ reason: null, status: "recovered" })
    }
  })

  it("is idempotent for matching IDs, rejects conflicting IDs, and applies bounded backpressure", () => {
    const storage = createVirtualEventJournalStorage()
    const journal = createEventJournal({ maxRecords: 1, storage })
    const first = record("record-1", 100)

    expect(journal.append(first).outcome).toBe("accepted")
    expect(journal.append(record("record-1", 100)).outcome).toBe("duplicate")
    expect(journal.append(record("record-1", 101)).outcome).toBe("conflict")
    expect(journal.append(record("record-2", 200)).outcome).toBe("backpressure")
    expect(storage.writes).toEqual(["prepared-header", "prepared-records", "prepared-integrity", "commit-marker"])
  })

  it("fails closed after CRC, digest, record, or structural corruption", () => {
    for (const target of ["crc", "digest", "record", "structure"] as const) {
      const storage = createVirtualEventJournalStorage()
      const journal = createEventJournal({ storage })
      journal.append(record("record-1", 100))
      if (target === "record") {
        journal.append(record("record-2", 200))
      }
      storage.corruptCommitted(target)

      const rebooted = createEventJournal({ storage })
      expect(rebooted.records).toEqual([])
      expect(rebooted.recovery).toEqual({
        reason: target === "record" ? "crc" : target,
        status: "corrupt"
      })
      expect(() => rebooted.append(record("record-2", 200))).toThrow("cannot append")
    }
  })

  it("rejects invalid construction and cannot corrupt an empty checkpoint", () => {
    expect(() => createEventJournal(null as never)).toThrow("options")
    expect(() => createEventJournal({ storage: null as never })).toThrow("storage")
    expect(() => createEventJournal({ storage: {} as never })).toThrow("readCommitted")
    expect(() => createEventJournal({ maxRecords: 0, storage: createVirtualEventJournalStorage() })).toThrow("capacity")
    expect(() => createEventJournal({ maxRecords: Number.NaN, storage: createVirtualEventJournalStorage() })).toThrow(
      "capacity"
    )
    expect(() => createEventJournal({ maxRecords: -1, storage: createVirtualEventJournalStorage() })).toThrow(
      "capacity"
    )
    expect(() => createEventJournal({ maxRecords: 65, storage: createVirtualEventJournalStorage() })).toThrow(
      "capacity"
    )
    expect(() => createVirtualEventJournalStorage().corruptCommitted("crc")).toThrow("no committed")
  })

  it("fails closed for a checkpoint beyond its configured capacity and for exhausted generations", () => {
    const storage = createVirtualEventJournalStorage()
    const journal = createEventJournal({ maxRecords: 2, storage })
    journal.append(record("record-1", 100))
    journal.append(record("record-2", 200))
    expect(createEventJournal({ maxRecords: 1, storage }).recovery).toEqual({ reason: "capacity", status: "corrupt" })

    storage.corruptCommitted("generation")
    const exhausted = createEventJournal({ maxRecords: 3, storage })
    expect(exhausted.recovery).toEqual({ reason: null, status: "recovered" })
    expect(() => exhausted.append(record("record-3", 300))).toThrow("generation is exhausted")
  })

  it("uses the default capacity for a representative multi-record checkpoint", () => {
    const storage = createVirtualEventJournalStorage()
    const journal = createEventJournal({ storage })

    for (let index = 0; index < 32; index += 1) {
      expect(journal.append(record(`record-${index}`, index)).outcome).toBe("accepted")
    }

    expect(createEventJournal({ storage }).records).toHaveLength(32)
    expect(journal.append(record("record-overflow", 100)).outcome).toBe("backpressure")
  })

  it("preserves a null-valued opaque field in the integrity projection", () => {
    const storage = createVirtualEventJournalStorage()
    const journal = createEventJournal({ storage })
    const base = record("record-false", 99)
    const falseLatched = { ...base, outcome: { ...base.outcome, signal: { ...base.outcome.signal, latched: false } } }
    const nullValue = { ...record("record-null", 100), ignoredValue: null }

    expect(journal.append(nullValue).outcome).toBe("accepted")
    expect(journal.append(falseLatched).outcome).toBe("accepted")
  })

  it("bounds canonical integrity input before any durable write", () => {
    const storage = createVirtualEventJournalStorage()
    const journal = createEventJournal({ storage })
    const longIdentifier = "r".repeat(4_097)
    const longKey = "k".repeat(4_097)
    const tooManyValues = { ...record("record-many", 100), ignoredValues: Array.from({ length: 8_193 }, () => 0) }
    const tooManyBytes = {
      ...record("record-bytes", 100),
      ignoredValues: Array.from({ length: 600 }, () => "x".repeat(200))
    }
    const tooManyFields = Object.fromEntries(Array.from({ length: 8_193 }, (_, index) => [`ignored-${index}`, index]))
    const nonPlainValue = { ...record("record-map", 100), ignoredValue: new Map() }
    const unsafeNumber = { ...record("record-nan", 100), ignoredValue: Number.NaN }
    const longIdentifierRecord = { ...record(longIdentifier, 100) }
    const longKeyRecord = { ...record("record-key", 100), [longKey]: 1 }
    const tooManyFieldRecord = { ...record("record-fields", 100), ...tooManyFields }

    expect(journal.append(longIdentifierRecord).outcome).toBe("backpressure")
    expect(journal.append(longKeyRecord).outcome).toBe("backpressure")
    expect(journal.append(tooManyValues).outcome).toBe("backpressure")
    expect(journal.append(tooManyBytes).outcome).toBe("backpressure")
    expect(journal.append(tooManyFieldRecord).outcome).toBe("backpressure")
    expect(() => journal.append(nonPlainValue)).toThrow("plain data")
    expect(() => journal.append(unsafeNumber)).toThrow("safe integer")
    expect(storage.writes).toEqual([])
    expect(createEventJournal({ storage }).records).toEqual([])
  })

  it("rejects an incomplete direct commit marker from the virtual medium", () => {
    const storage = createVirtualEventJournalStorage()
    expect(() => storage.writeCommitMarker()).toThrow("incomplete")
  })
})
