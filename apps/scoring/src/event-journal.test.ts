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

  it("isolates caller records and retains the parser's deep-frozen record identity", () => {
    const storage = createVirtualEventJournalStorage()
    const sourceRecord = record("record-1", 100)
    const source = {
      ...sourceRecord,
      provenance: {
        ...sourceRecord.provenance,
        firmware: { ...sourceRecord.provenance.firmware }
      }
    }
    const journal = createEventJournal({ storage })

    const receipt = journal.append(source)
    expect(receipt.outcome).toBe("accepted")
    if (receipt.outcome !== "accepted") return

    expect(receipt.record).not.toBe(source)
    expect(journal.records).not.toBe(journal.records)
    expect(journal.records[0]).toBe(receipt.record)

    ;(source.outcome.signal as { latched: boolean }).latched = false
    ;(source.provenance.firmware as { identity: string }).identity = "caller-mutated"
    expect(receipt.record.outcome.signal.latched).toBe(true)
    expect(receipt.record.provenance.firmware.identity).toBe("stm32-scoring")

    expect(Object.isFrozen(receipt.record)).toBe(true)
    expect(Object.isFrozen(receipt.record.captureWindow)).toBe(true)
    expect(Object.isFrozen(receipt.record.outcome)).toBe(true)
    expect(Object.isFrozen(receipt.record.outcome.signal)).toBe(true)
    expect(Object.isFrozen(receipt.record.provenance)).toBe(true)
    expect(Object.isFrozen(receipt.record.provenance.firmware)).toBe(true)
    expect(Object.isFrozen(receipt.record.rawCaptureRefs)).toBe(true)
    expect(Object.isFrozen(receipt.record.rawCaptureRefs[0])).toBe(true)
    expect(() => {
      ;(receipt.record.outcome.signal as { latched: boolean }).latched = false
    }).toThrow(TypeError)

    const recovered = createEventJournal({ storage })
    expect(recovered.records[0]).not.toBe(receipt.record)
    expect(recovered.records).toEqual(journal.records)
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
    expect(() => createEventJournal(Object.create(null) as never)).toThrow("plain object")
    expect(() => createEventJournal({ extra: true, storage: createVirtualEventJournalStorage() } as never)).toThrow(
      "unrecognized"
    )
    expect(() => createEventJournal({ maxRecords: 1 } as never)).toThrow("missing")
    expect(() =>
      createEventJournal({ storage: createVirtualEventJournalStorage(), [Symbol("extra")]: true } as never)
    ).toThrow("unrecognized")
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

  it("preserves valid null-valued schema fields in the integrity projection", () => {
    const storage = createVirtualEventJournalStorage()
    const journal = createEventJournal({ storage })
    const base = record("record-false", 99)
    const falseLatched = { ...base, outcome: { ...base.outcome, signal: { ...base.outcome.signal, latched: false } } }
    const nullSide = {
      ...record("record-null", 100),
      outcome: {
        detectedAtUs: 100,
        diagnostic: "open-circuit" as const,
        disposition: "line-fault" as const,
        lineId: "left-A",
        persistence: "transient" as const,
        side: null,
        signal: { audible: "none" as const, latched: false, visual: "diagnostic" as const }
      }
    }

    expect(journal.append(nullSide).outcome).toBe("accepted")
    expect(journal.append(falseLatched).outcome).toBe("accepted")
  })

  it("rejects noncanonical records before any durable write", () => {
    const storage = createVirtualEventJournalStorage()
    const journal = createEventJournal({ storage })
    const longIdentifier = "r".repeat(4_097)
    const longKey = "k".repeat(4_097)
    const unexpectedField = { ...record("record-extra", 100), unexpectedField: null }
    const nonPlainValue = { ...record("record-map", 100), outcome: new Map() }
    const unsafeNumber = { ...record("record-nan", 100), decisionAtUs: Number.NaN }
    const longIdentifierRecord = { ...record(longIdentifier, 100) }
    const longKeyRecord = { ...record("record-key", 100), [longKey]: 1 }

    for (const invalidRecord of [longIdentifierRecord, longKeyRecord, unexpectedField, nonPlainValue, unsafeNumber]) {
      expect(() => journal.append(invalidRecord as DecisionRecord)).toThrow("Unsupported or invalid decision record")
    }
    expect(storage.writes).toEqual([])
    expect(createEventJournal({ storage }).records).toEqual([])
  })

  it("rejects an incomplete direct commit marker from the virtual medium", () => {
    const storage = createVirtualEventJournalStorage()
    expect(() => storage.writeCommitMarker()).toThrow("incomplete")
  })

  it("gives a storage adapter an immutable checkpoint input", () => {
    const medium = createVirtualEventJournalStorage()
    let suppliedRecords: readonly DecisionRecord[] | null = null
    const storage = {
      readCommitted: medium.readCommitted,
      writeCommitMarker: medium.writeCommitMarker,
      writePreparedHeader: medium.writePreparedHeader,
      writePreparedIntegrity: medium.writePreparedIntegrity,
      writePreparedRecords(records: readonly DecisionRecord[]) {
        suppliedRecords = records
        medium.writePreparedRecords(records)
      }
    }
    const journal = createEventJournal({ storage })

    expect(journal.append(record("record-1", 100)).outcome).toBe("accepted")
    expect(suppliedRecords).not.toBeNull()
    expect(Object.isFrozen(suppliedRecords)).toBe(true)
    expect(() => (suppliedRecords as DecisionRecord[]).push(record("record-2", 200))).toThrow()
    expect(createEventJournal({ storage }).records.map((entry) => entry.recordId)).toEqual(["record-1"])
  })
})
