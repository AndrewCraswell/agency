/**
 * M2-08 virtual event journal.
 *
 * This is a host-only transaction model, not a flash driver or a production
 * record encoding. It models four independently durable write boundaries and
 * accepts a checkpoint only after its complete commit marker is present.
 */

import { createHash } from "node:crypto"
import { parseDecisionRecord, type DecisionRecord } from "./decision-record.js"

export const DEFAULT_EVENT_JOURNAL_MAX_RECORDS = 32
export const MAX_EVENT_JOURNAL_RECORDS = 32

const MAX_CANONICAL_CONTENT_BYTES = 65_536
const MAX_CANONICAL_ENTRIES = 8_192
const MAX_CANONICAL_STRING_LENGTH = 4_096
const MAX_SAFE_GENERATION = Number.MAX_SAFE_INTEGER - 1

export const EVENT_JOURNAL_WRITE_BOUNDARIES = [
  "prepared-header",
  "prepared-records",
  "prepared-integrity",
  "commit-marker"
] as const

export type EventJournalWriteBoundary = (typeof EVENT_JOURNAL_WRITE_BOUNDARIES)[number]

export type EventJournalIntegrity = Readonly<{
  contentDigest: string
  crc32c: number
}>

export type EventJournalHeader = Readonly<{
  generation: number
  recordCount: number
}>

export type EventJournalTransaction = Readonly<{
  header: EventJournalHeader
  integrity: EventJournalIntegrity
  records: readonly DecisionRecord[]
}>

export type EventJournalStorage = Readonly<{
  readCommitted: () => EventJournalTransaction | null
  writeCommitMarker: () => void
  writePreparedHeader: (header: EventJournalHeader) => void
  writePreparedIntegrity: (integrity: EventJournalIntegrity) => void
  writePreparedRecords: (records: readonly DecisionRecord[]) => void
}>

export type VirtualEventJournalStorage = EventJournalStorage &
  Readonly<{
    armPowerLoss: (boundary: EventJournalWriteBoundary) => void
    corruptCommitted: (target: "crc" | "digest" | "generation" | "record" | "structure") => void
    readonly writes: readonly EventJournalWriteBoundary[]
  }>

export type EventJournalRecovery = Readonly<{
  reason: "capacity" | "crc" | "digest" | "structure" | null
  status: "corrupt" | "empty" | "recovered"
}>

export type EventJournalAppendReceipt = Readonly<{
  outcome: "accepted" | "backpressure" | "conflict" | "duplicate"
  record: DecisionRecord
}>

export type EventJournal = Readonly<{
  append: (record: DecisionRecord) => EventJournalAppendReceipt
  readonly recovery: EventJournalRecovery
  readonly records: readonly DecisionRecord[]
}>

export type EventJournalOptions = Readonly<{
  maxRecords?: number
  storage: EventJournalStorage
}>

type PreparedTransaction = {
  header: EventJournalHeader | null
  integrity: EventJournalIntegrity | null
  records: readonly DecisionRecord[] | null
}

export class VirtualJournalPowerLoss extends Error {
  readonly boundary: EventJournalWriteBoundary

  constructor(boundary: EventJournalWriteBoundary) {
    super(`Virtual power loss after ${boundary}`)
    this.name = "VirtualJournalPowerLoss"
    this.boundary = boundary
  }
}

function isSafeNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function assertBoundedRecordCount(value: unknown, description: string): asserts value is number {
  if (!isSafeNonnegativeInteger(value) || value === 0 || value > MAX_EVENT_JOURNAL_RECORDS) {
    throw new RangeError(`${description} must be from 1 through ${MAX_EVENT_JOURNAL_RECORDS}`)
  }
}

function assertOptions(value: unknown): asserts value is EventJournalOptions {
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("Event journal options must be a plain object")
  }

  const allowedKeys = ["maxRecords", "storage"]
  const actualKeys = Reflect.ownKeys(value)
  if (
    actualKeys.length === 0 ||
    actualKeys.some((key) => {
      if (typeof key !== "string" || !allowedKeys.includes(key)) {
        return true
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable
    }) ||
    !actualKeys.includes("storage")
  ) {
    throw new TypeError("Event journal options have missing or unrecognized fields")
  }
}

function assertStorage(value: unknown): asserts value is EventJournalStorage {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Event journal storage must be an object")
  }
  const storage = value as Record<string, unknown>
  for (const method of [
    "readCommitted",
    "writeCommitMarker",
    "writePreparedHeader",
    "writePreparedIntegrity",
    "writePreparedRecords"
  ]) {
    if (typeof storage[method] !== "function") {
      throw new TypeError(`Event journal storage requires ${method}`)
    }
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value
}

function cloneRecord(value: unknown): DecisionRecord {
  return deepFreeze(structuredClone(parseDecisionRecord(value)))
}

/**
 * Deliberately private to this host model. It is only a stable byte source for
 * CRC/SHA fault injection; it is not the M0-06 or production journal codec.
 */
type CanonicalContext = {
  bytes: number
  entries: number
}

function consumeCanonicalText(context: CanonicalContext, text: string): string {
  context.bytes += new TextEncoder().encode(text).byteLength
  if (context.bytes > MAX_CANONICAL_CONTENT_BYTES) {
    throw new RangeError(`Virtual journal transactions cannot exceed ${MAX_CANONICAL_CONTENT_BYTES} bytes`)
  }
  return text
}

function canonicalValue(value: unknown, context: CanonicalContext): string {
  context.entries += 1
  /* v8 ignore next -- container preflight bounds ordinary canonical input before this defensive nested-value guard. */
  if (context.entries > MAX_CANONICAL_ENTRIES) {
    throw new RangeError(`Virtual journal transactions cannot exceed ${MAX_CANONICAL_ENTRIES} values`)
  }
  if (value === null) {
    return consumeCanonicalText(context, "null")
  }
  if (typeof value === "boolean") {
    return consumeCanonicalText(context, value ? "true" : "false")
  }
  if (typeof value === "number") {
    /* v8 ignore start -- parseDecisionRecord and the 32-record/8-reference limits bound the cloned data tree before canonicalization. */
    if (!Number.isSafeInteger(value)) {
      throw new TypeError("Virtual journal records must contain safe integer numbers")
    }
    /* v8 ignore stop */
    return consumeCanonicalText(context, `n:${value}`)
  }
  if (typeof value === "string") {
    /* v8 ignore start -- parseDecisionRecord and the 32-record/8-reference limits bound the cloned data tree before canonicalization. */
    if (value.length > MAX_CANONICAL_STRING_LENGTH) {
      throw new RangeError(`Virtual journal strings cannot exceed ${MAX_CANONICAL_STRING_LENGTH} characters`)
    }
    /* v8 ignore stop */
    return consumeCanonicalText(context, `s:${JSON.stringify(value)}`)
  }
  if (Array.isArray(value)) {
    /* v8 ignore start -- parseDecisionRecord and the 32-record/8-reference limits bound the cloned data tree before canonicalization. */
    if (value.length > MAX_CANONICAL_ENTRIES - context.entries) {
      throw new RangeError(`Virtual journal transactions cannot exceed ${MAX_CANONICAL_ENTRIES} values`)
    }
    /* v8 ignore stop */
    consumeCanonicalText(context, "[")
    const entries: string[] = []
    for (const entry of value) {
      if (entries.length > 0) {
        consumeCanonicalText(context, ",")
      }
      entries.push(canonicalValue(entry, context))
    }
    consumeCanonicalText(context, "]")
    return `[${entries.join(",")}]`
  }
  /* v8 ignore start -- parseDecisionRecord and the 32-record/8-reference limits bound the cloned data tree before canonicalization. */
  if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("Virtual journal records must contain plain data")
  }
  /* v8 ignore stop */

  const keys = Reflect.ownKeys(value)
  /* v8 ignore next -- cloneRecord does not preserve symbol keys. */
  if (keys.some((key) => typeof key !== "string")) {
    throw new TypeError("Virtual journal records must use string keys")
  }
  /* v8 ignore start -- parseDecisionRecord and the 32-record/8-reference limits bound the cloned data tree before canonicalization. */
  if (keys.length > MAX_CANONICAL_ENTRIES - context.entries) {
    throw new RangeError(`Virtual journal transactions cannot exceed ${MAX_CANONICAL_ENTRIES} values`)
  }
  /* v8 ignore stop */
  consumeCanonicalText(context, "{")
  const entries: string[] = []
  for (const key of keys.sort()) {
    /* v8 ignore start -- parseDecisionRecord and the 32-record/8-reference limits bound the cloned data tree before canonicalization. */
    if (typeof key !== "string" || key.length > MAX_CANONICAL_STRING_LENGTH) {
      throw new RangeError(`Virtual journal keys cannot exceed ${MAX_CANONICAL_STRING_LENGTH} characters`)
    }
    /* v8 ignore stop */
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    /* v8 ignore next -- cloneRecord eliminates accessors before canonicalization. */
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError("Virtual journal records cannot contain accessors")
    }
    if (entries.length > 0) {
      consumeCanonicalText(context, ",")
    }
    const encodedKey = JSON.stringify(key)
    consumeCanonicalText(context, `${encodedKey}:`)
    entries.push(`${encodedKey}:${canonicalValue(descriptor.value, context)}`)
  }
  consumeCanonicalText(context, "}")
  return `{${entries.join(",")}}`
}

function canonicalTransactionContent(header: EventJournalHeader, records: readonly DecisionRecord[]): string {
  return canonicalValue({ generation: header.generation, records }, { bytes: 0, entries: 0 })
}

function calculateCrc32c(content: string): number {
  let crc = 0xffff_ffff
  for (const byte of new TextEncoder().encode(content)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0x82f6_3b78 : 0)
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0
}

function integrityFor(header: EventJournalHeader, records: readonly DecisionRecord[]): EventJournalIntegrity {
  const content = canonicalTransactionContent(header, records)
  return Object.freeze({
    contentDigest: `sha256:${createHash("sha256").update(content).digest("hex")}`,
    crc32c: calculateCrc32c(content)
  })
}

function recordsMatch(left: DecisionRecord, right: DecisionRecord): boolean {
  return canonicalValue(left, { bytes: 0, entries: 0 }) === canonicalValue(right, { bytes: 0, entries: 0 })
}

function cloneTransaction(transaction: EventJournalTransaction): EventJournalTransaction {
  return deepFreeze({
    header: { ...transaction.header },
    integrity: { ...transaction.integrity },
    records: transaction.records.map(cloneRecord)
  })
}

/** Creates an in-memory medium that can lose power after any durable boundary. */
export function createVirtualEventJournalStorage(): VirtualEventJournalStorage {
  let committed: EventJournalTransaction | null = null
  let prepared: PreparedTransaction = { header: null, integrity: null, records: null }
  let armedBoundary: EventJournalWriteBoundary | null = null
  const writes: EventJournalWriteBoundary[] = []

  function afterWrite(boundary: EventJournalWriteBoundary): void {
    writes.push(boundary)
    if (armedBoundary === boundary) {
      armedBoundary = null
      throw new VirtualJournalPowerLoss(boundary)
    }
  }

  function writePreparedHeader(header: EventJournalHeader): void {
    prepared = { header: deepFreeze({ ...header }), integrity: null, records: null }
    afterWrite("prepared-header")
  }

  function writePreparedRecords(records: readonly DecisionRecord[]): void {
    prepared = { ...prepared, records: records.map(cloneRecord) }
    afterWrite("prepared-records")
  }

  function writePreparedIntegrity(integrity: EventJournalIntegrity): void {
    prepared = { ...prepared, integrity: deepFreeze({ ...integrity }) }
    afterWrite("prepared-integrity")
  }

  function writeCommitMarker(): void {
    if (prepared.header === null || prepared.records === null || prepared.integrity === null) {
      throw new RangeError("Virtual journal cannot commit an incomplete prepared transaction")
    }
    committed = deepFreeze({
      header: { ...prepared.header },
      integrity: { ...prepared.integrity },
      records: prepared.records.map(cloneRecord)
    })
    prepared = { header: null, integrity: null, records: null }
    afterWrite("commit-marker")
  }

  function corruptCommitted(target: "crc" | "digest" | "generation" | "record" | "structure"): void {
    if (committed === null) {
      throw new RangeError("Virtual journal has no committed transaction to corrupt")
    }
    if (target === "crc") {
      committed = deepFreeze({
        header: { ...committed.header },
        integrity: { ...committed.integrity, crc32c: (committed.integrity.crc32c + 1) >>> 0 },
        records: committed.records.map(cloneRecord)
      })
    } else if (target === "digest") {
      committed = deepFreeze({
        header: { ...committed.header },
        integrity: { ...committed.integrity, contentDigest: `sha256:${"0".repeat(64)}` },
        records: committed.records.map(cloneRecord)
      })
    } else if (target === "generation") {
      const header = { ...committed.header, generation: Number.MAX_SAFE_INTEGER }
      committed = deepFreeze({
        header,
        integrity: integrityFor(header, committed.records),
        records: committed.records.map(cloneRecord)
      })
    } else if (target === "structure") {
      committed = deepFreeze({
        header: { ...committed.header, recordCount: committed.header.recordCount + 1 },
        integrity: { ...committed.integrity },
        records: committed.records.map(cloneRecord)
      })
    } else {
      committed = deepFreeze({
        header: { ...committed.header },
        integrity: { ...committed.integrity },
        records: committed.records.map((record, index) =>
          index === 0
            ? deepFreeze({ ...structuredClone(record), recordId: `${record.recordId}-corrupt` })
            : cloneRecord(record)
        )
      })
    }
  }

  return {
    armPowerLoss(boundary) {
      armedBoundary = boundary
    },
    corruptCommitted,
    readCommitted() {
      return committed === null ? null : cloneTransaction(committed)
    },
    get writes() {
      return writes.slice()
    },
    writeCommitMarker,
    writePreparedHeader,
    writePreparedIntegrity,
    writePreparedRecords
  }
}

function recover(
  storage: EventJournalStorage,
  maxRecords: number
): Readonly<{ records: readonly DecisionRecord[]; recovery: EventJournalRecovery; generation: number }> {
  const transaction = storage.readCommitted()
  if (transaction === null) {
    return { generation: 0, records: [], recovery: Object.freeze({ reason: null, status: "empty" }) }
  }

  try {
    if (
      !isSafeNonnegativeInteger(transaction.header.generation) ||
      !isSafeNonnegativeInteger(transaction.header.recordCount) ||
      transaction.header.recordCount !== transaction.records.length
    ) {
      throw new TypeError("structure")
    }
    if (transaction.records.length > maxRecords) {
      throw new RangeError("capacity")
    }
    const records = transaction.records.map(cloneRecord)
    const expected = integrityFor(transaction.header, records)
    if (transaction.integrity.crc32c !== expected.crc32c) {
      throw new RangeError("crc")
    }
    if (transaction.integrity.contentDigest !== expected.contentDigest) {
      throw new RangeError("digest")
    }
    return {
      generation: transaction.header.generation,
      records,
      recovery: Object.freeze({ reason: null, status: "recovered" })
    }
  } catch (error) {
    const reason =
      error instanceof RangeError && error.message === "capacity"
        ? "capacity"
        : error instanceof RangeError && error.message === "crc"
          ? "crc"
          : error instanceof RangeError && error.message === "digest"
            ? "digest"
            : "structure"
    return { generation: 0, records: [], recovery: Object.freeze({ reason, status: "corrupt" }) }
  }
}

/**
 * Opens a bounded journal from its durable checkpoint. A corrupt checkpoint is
 * unavailable to callers; it is never treated as replay evidence.
 */
export function createEventJournal(options: EventJournalOptions): EventJournal {
  assertOptions(options)
  assertStorage(options.storage)
  const maxRecords = options.maxRecords ?? DEFAULT_EVENT_JOURNAL_MAX_RECORDS
  assertBoundedRecordCount(maxRecords, "Event journal record capacity")

  const restored = recover(options.storage, maxRecords)
  let generation = restored.generation
  let records: readonly DecisionRecord[] = restored.records.slice()
  const recovery = restored.recovery

  function append(value: DecisionRecord): EventJournalAppendReceipt {
    if (recovery.status === "corrupt") {
      throw new RangeError("Event journal cannot append while recovery is corrupt")
    }
    const record = cloneRecord(value)
    const existing = records.find((candidate) => candidate.recordId === record.recordId)
    if (existing !== undefined) {
      return Object.freeze({ outcome: recordsMatch(existing, record) ? "duplicate" : "conflict", record: existing })
    }
    if (records.length === maxRecords) {
      return Object.freeze({ outcome: "backpressure", record })
    }
    if (generation > MAX_SAFE_GENERATION) {
      throw new RangeError("Event journal generation is exhausted")
    }

    const nextRecords = Object.freeze([...records, record])
    const header = Object.freeze({ generation: generation + 1, recordCount: nextRecords.length })
    let integrity: EventJournalIntegrity
    try {
      integrity = integrityFor(header, nextRecords)
    } catch (error) {
      if (error instanceof RangeError) {
        return Object.freeze({ outcome: "backpressure", record })
      }
      throw error
    }
    options.storage.writePreparedHeader(header)
    options.storage.writePreparedRecords(nextRecords)
    options.storage.writePreparedIntegrity(integrity)
    options.storage.writeCommitMarker()

    generation = header.generation
    records = nextRecords
    return Object.freeze({ outcome: "accepted", record })
  }

  return {
    append,
    get recovery() {
      return recovery
    },
    get records() {
      return records.slice()
    }
  }
}
