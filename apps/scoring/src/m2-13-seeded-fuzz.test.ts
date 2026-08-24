import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { DecisionRecord, DecisionRecordOutcome } from "./decision-record.js"
import {
  createEventJournal,
  createVirtualEventJournalStorage,
  EVENT_JOURNAL_WRITE_BOUNDARIES,
  VirtualJournalPowerLoss
} from "./event-journal.js"
import {
  calculateCrc32c,
  decodeTransportFrame,
  encodeTransportFrame,
  MAX_TRANSPORT_FRAME_BYTES,
  MAX_TRANSPORT_PAYLOAD_BYTES,
  TRANSPORT_FRAME_HEADER_BYTES,
  type TransportMessageType
} from "./transport-frame.js"
import { createVirtualClock } from "./virtual-clock.js"
import { createVirtualEsp32 } from "./virtual-esp32.js"
import { createVirtualProcessorLink, type VirtualLinkAttempt } from "./virtual-processor-link.js"

type SeedFixture = Readonly<{
  format: string
  iterationsPerSeed: number
  maxJournalRecords: number
  maxPayloadBytes: number
  reportDigest: string
  seeds: readonly string[]
}>

const SEED_FIXTURE = JSON.parse(
  readFileSync(new URL("../fixtures/m2-13-seed-corpus.json", import.meta.url), "utf8")
) as SeedFixture

const EXPECTED_FORMAT = "m2-13-seeded-fuzz-v1"
const MAX_SEED = 0xffff_ffff
const INVALID_PAYLOAD_ACTION = 0
const TRUNCATED_ACTION = 1
const LENGTH_ACTION = 2
const VERSION_ACTION = 3
const TYPE_ACTION = 4
const CRC_ACTION = 5
const DIRECTION_ACTION = 6
const TRAILING_ACTION = 7
const ACTION_COUNT = 8
const MAX_FUZZ_ITERATIONS = 256
const MAX_RECORD_ID_LENGTH = 64

type FuzzReport = Readonly<{
  acceptedRecords: number
  duplicateRejections: number
  invalidDecisionPayloads: number
  journalBoundaryCases: number
  journalNewRecoveries: number
  journalOldRecoveries: number
  malformedByCode: Readonly<Record<string, number>>
  maxFrameBytes: number
  maxPayloadBytes: number
  protocolCases: number
  seedCount: number
  totalIterations: number
}>

type SeededRandom = Readonly<{
  nextInt: (maxExclusive: number) => number
  nextUint32: () => number
  bytes: (length: number) => Uint8Array
}>

function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0

  return {
    bytes(length) {
      const bytes = new Uint8Array(length)
      for (let index = 0; index < length; index += 1) {
        bytes[index] = this.nextUint32() & 0xff
      }
      return bytes
    },
    nextInt(maxExclusive) {
      if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1) {
        throw new RangeError("M2-13 random bounds must be positive safe integers")
      }
      return this.nextUint32() % maxExclusive
    },
    nextUint32() {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      return state
    }
  }
}

function parseSeed(value: string): number {
  if (!/^0x[0-9a-f]{8}$/u.test(value)) {
    throw new TypeError(`Invalid M2-13 seed: ${value}`)
  }
  const seed = Number.parseInt(value.slice(2), 16)
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new RangeError(`M2-13 seed is outside the unsigned 32-bit range: ${value}`)
  }
  return seed
}

function assertSeedFixture(fixture: SeedFixture): readonly number[] {
  if (fixture.format !== EXPECTED_FORMAT) {
    throw new TypeError("M2-13 seed fixture format is not supported")
  }
  if (
    fixture.iterationsPerSeed < 1 ||
    fixture.iterationsPerSeed > MAX_FUZZ_ITERATIONS ||
    fixture.maxPayloadBytes !== MAX_TRANSPORT_PAYLOAD_BYTES ||
    fixture.maxJournalRecords < 1 ||
    fixture.maxJournalRecords > 32 ||
    fixture.seeds.length < 1 ||
    fixture.seeds.length * fixture.iterationsPerSeed > MAX_FUZZ_ITERATIONS ||
    !/^sha256:[0-9a-f]{64}$/u.test(fixture.reportDigest)
  ) {
    throw new RangeError("M2-13 seed fixture exceeds the bounded fuzz limits")
  }
  const seeds = fixture.seeds.map(parseSeed)
  if (new Set(seeds).size !== seeds.length) {
    throw new RangeError("M2-13 seed fixture must not repeat a seed")
  }
  return seeds
}

function recordOutcome(variant: number, atUs: number): DecisionRecordOutcome {
  const signal = { audible: "requested" as const, latched: variant % 2 === 0, visual: "diagnostic" as const }

  switch (variant % 7) {
    case 0:
      return {
        disposition: "qualified-hit",
        hitStartedAtUs: atUs,
        qualifiedAtUs: atUs,
        side: "left",
        signal: { ...signal, visual: "valid-hit" },
        weapon: "epee"
      }
    case 1:
      return { disposition: "off-target", qualifiedAtUs: atUs, side: "right", signal, weapon: "foil" }
    case 2:
      return {
        attemptedAtUs: atUs,
        attemptedSide: "left",
        disposition: "rejected-contact",
        reason: "contact-below-minimum-duration",
        signal,
        weapon: "sabre"
      }
    case 3:
      return {
        detectedAtUs: atUs,
        diagnostic: "acquisition-gap",
        disposition: "line-fault",
        lineId: "tip-left",
        persistence: "transient",
        side: null,
        signal
      }
    case 4:
      return { cause: "watchdog", disposition: "reset", resetAtUs: atUs, scope: "stm32", signal }
    case 5:
      return {
        disposition: "uncertainty",
        effect: "not-qualified",
        lowerBound: 1,
        observedAtUs: atUs,
        signal,
        subject: "timing",
        unit: "us",
        upperBound: 2
      }
    default:
      return {
        calibrationId: "calibration-fuzz",
        disposition: "calibration",
        performedAtUs: atUs,
        signal,
        status: "passed"
      }
  }
}

function makeRecord(recordId: string, atUs: number, variant: number): DecisionRecord {
  if (recordId.length > MAX_RECORD_ID_LENGTH) {
    throw new RangeError("M2-13 record IDs exceed the test bound")
  }
  const outcome = recordOutcome(variant, atUs)
  return {
    captureWindow: { firstSequence: atUs, fromUs: atUs, lastSequence: atUs, throughUs: atUs },
    decisionAtUs: atUs,
    outcome,
    provenance: {
      calibrationProfileRevision: "calibration-1",
      firmware: {
        buildDigest: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        identity: "stm32-fuzz",
        scoringBootId: "boot-fuzz"
      },
      hardwareRevision: "evt-fuzz",
      lineContractRevision: "lines-1",
      ruleSetRevision: "rules-1",
      timingTableRevision: "timing-1"
    },
    rawCaptureRefs:
      outcome.disposition === "calibration"
        ? [
            {
              captureId: `calibration-capture-${recordId}`,
              contentDigest: `sha256:${"cd".repeat(32)}`,
              contentFormatRevision: "capture-1",
              firstSequence: atUs,
              fromUs: atUs,
              kind: "calibration-measurements",
              lastSequence: atUs,
              sampleCount: 1,
              throughUs: atUs
            }
          ]
        : [],
    recordId,
    schemaVersion: 1
  }
}

function payloadFor(record: unknown): Uint8Array {
  const payload = new TextEncoder().encode(JSON.stringify(record))
  if (payload.length > MAX_TRANSPORT_PAYLOAD_BYTES) {
    throw new RangeError("M2-13 decision payload exceeded the transport bound")
  }
  return payload
}

function jsonDecoder(payload: Uint8Array): unknown {
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payload))
}

function makeFrame(messageType: TransportMessageType, sequence: number, payload: Uint8Array): Uint8Array {
  return encodeTransportFrame({ flags: 0, messageType, payload, sequence })
}

function mutateFrame(frame: Uint8Array, action: number): Uint8Array {
  switch (action) {
    case TRUNCATED_ACTION:
      return frame.slice(0, TRANSPORT_FRAME_HEADER_BYTES - 1)
    case LENGTH_ACTION: {
      const altered = frame.slice()
      altered.set([0, 0, 0x10, 0x01], 10)
      return altered
    }
    case VERSION_ACTION: {
      const altered = frame.slice()
      altered[2] = 2
      return altered
    }
    case TYPE_ACTION: {
      const altered = frame.slice()
      altered[3] = 0xff
      return altered
    }
    case CRC_ACTION: {
      const altered = frame.slice()
      altered[altered.length - 1] ^= 1
      return altered
    }
    case TRAILING_ACTION:
      return new Uint8Array([...frame, 0xa5])
    default:
      return frame
  }
}

function deliver(
  receiver: ReturnType<typeof createVirtualEsp32>,
  sender: "esp32" | "stm32",
  frame: Uint8Array
): readonly ReturnType<typeof receiver.receive>[] {
  const clock = createVirtualClock()
  const receipts: ReturnType<typeof receiver.receive>[] = []
  const link = createVirtualProcessorLink({
    clock,
    onDelivery: (attempt: VirtualLinkAttempt) => receipts.push(receiver.receive(attempt))
  })
  link.send(sender, frame)
  clock.runUntilIdle()
  return receipts
}

function malformedCode(frame: Uint8Array, receiver: "esp32" | "stm32", expected: string): void {
  expect(() => decodeTransportFrame(receiver, frame)).toThrow(expect.objectContaining({ code: expected }))
}

function invalidRecord(record: DecisionRecord, variant: number): unknown {
  switch (variant % 5) {
    case 0:
      return { ...record, schemaVersion: 2 }
    case 1:
      return { ...record, decisionAtUs: record.decisionAtUs + 1 }
    case 2:
      return { ...record, outcome: { ...record.outcome, disposition: "future-outcome" } }
    case 3:
      return {
        ...record,
        rawCaptureRefs: Array.from({ length: 9 }, (_, index) => ({
          captureId: `capture-${index}`,
          contentDigest: `sha256:${"ab".repeat(32)}`,
          contentFormatRevision: "capture-1",
          firstSequence: record.decisionAtUs,
          fromUs: record.decisionAtUs,
          kind: "fault-context" as const,
          lastSequence: record.decisionAtUs,
          sampleCount: 1,
          throughUs: record.decisionAtUs
        }))
      }
    default:
      return {
        ...record,
        provenance: {
          ...record.provenance,
          firmware: { ...record.provenance.firmware, buildDigest: "sha256:bad" }
        }
      }
  }
}

function runSeed(seed: number, iterations: number): FuzzReport {
  const random = createSeededRandom(seed)
  const malformedByCode: Record<string, number> = {}
  let acceptedRecords = 0
  let duplicateRejections = 0
  let invalidDecisionPayloads = 0
  let maxFrameBytes = 0
  let maxPayloadBytes = 0
  let protocolCases = 0

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const action = iteration % ACTION_COUNT
    const record = makeRecord(`record-${seed.toString(16)}-${iteration}`, random.nextInt(1_000_000), iteration)
    const validPayload = payloadFor(record)
    const fuzzPayload = random.bytes(random.nextInt(MAX_TRANSPORT_PAYLOAD_BYTES))
    const frame = makeFrame("decision-record", 0, fuzzPayload)
    maxPayloadBytes = Math.max(maxPayloadBytes, fuzzPayload.length, validPayload.length)
    maxFrameBytes = Math.max(maxFrameBytes, frame.length)
    protocolCases += 1

    if (action === INVALID_PAYLOAD_ACTION) {
      const validFrame = makeFrame("decision-record", 0, validPayload)
      const receiver = createVirtualEsp32({ decodeDecisionRecordPayload: jsonDecoder, maxRecords: 4 })
      const first = deliver(receiver, "stm32", validFrame)
      const duplicate = deliver(receiver, "stm32", makeFrame("decision-record", 1, validPayload))
      const invalid = deliver(receiver, "stm32", makeFrame("decision-record", 2, new Uint8Array([0xff])))
      expect(first[0]).toMatchObject({ outcome: "accepted", sequence: 0 })
      expect(first[0]?.record).toEqual(record)
      expect(duplicate[0]).toMatchObject({ outcome: "rejected", reason: "record-duplicate", sequence: 1 })
      expect(invalid[0]).toMatchObject({ outcome: "rejected", reason: "payload", sequence: 2 })
      expect(receiver.records).toEqual([record])
      acceptedRecords += 1
      duplicateRejections += 1
      invalidDecisionPayloads += 1
      continue
    }

    if (action === DIRECTION_ACTION) {
      const request = makeFrame("request", 0, fuzzPayload)
      malformedCode(request, "esp32", "direction")
      malformedCode(makeFrame("decision-record", 0, fuzzPayload), "stm32", "direction")
      malformedByCode.direction = (malformedByCode.direction ?? 0) + 2
      const receiver = createVirtualEsp32({ decodeDecisionRecordPayload: jsonDecoder })
      expect(deliver(receiver, "esp32", request)[0]).toMatchObject({ outcome: "rejected", reason: "delivery" })
      continue
    }

    const expected =
      action === TRUNCATED_ACTION
        ? "truncated"
        : action === LENGTH_ACTION
          ? "payload-length"
          : action === VERSION_ACTION
            ? "version"
            : action === TYPE_ACTION
              ? "message-type"
              : action === CRC_ACTION
                ? "crc"
                : "trailing-bytes"
    malformedCode(mutateFrame(frame, action), "esp32", expected)
    malformedByCode[expected] = (malformedByCode[expected] ?? 0) + 1
  }

  return {
    acceptedRecords,
    duplicateRejections,
    invalidDecisionPayloads,
    journalBoundaryCases: 0,
    journalNewRecoveries: 0,
    journalOldRecoveries: 0,
    malformedByCode,
    maxFrameBytes,
    maxPayloadBytes,
    protocolCases,
    seedCount: 1,
    totalIterations: iterations
  }
}

function runJournalSeed(
  seed: number,
  iterations: number
): Pick<FuzzReport, "journalBoundaryCases" | "journalNewRecoveries" | "journalOldRecoveries"> {
  let journalBoundaryCases = 0
  let journalNewRecoveries = 0
  let journalOldRecoveries = 0

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const atUs = seed + iteration
    const oldRecord = makeRecord(`journal-${seed.toString(16)}-${iteration}-old`, atUs, iteration)
    const newRecord = makeRecord(`journal-${seed.toString(16)}-${iteration}-new`, atUs + 1, iteration + 1)

    for (const boundary of EVENT_JOURNAL_WRITE_BOUNDARIES) {
      const storage = createVirtualEventJournalStorage()
      const journal = createEventJournal({ maxRecords: SEED_FIXTURE.maxJournalRecords, storage })
      expect(journal.append(oldRecord).outcome).toBe("accepted")
      expect(journal.append(oldRecord).outcome).toBe("duplicate")
      expect(journal.append(makeRecord(oldRecord.recordId, atUs + 2, iteration + 2)).outcome).toBe("conflict")
      storage.armPowerLoss(boundary)
      expect(() => journal.append(newRecord)).toThrowError(
        expect.objectContaining({
          boundary,
          name: VirtualJournalPowerLoss.name
        })
      )
      const rebooted = createEventJournal({ maxRecords: SEED_FIXTURE.maxJournalRecords, storage })
      const recoveredIds = rebooted.records.map(({ recordId }) => recordId)
      const expectedIds = boundary === "commit-marker" ? [oldRecord.recordId, newRecord.recordId] : [oldRecord.recordId]
      expect(recoveredIds).toEqual(expectedIds)
      expect(rebooted.records).toEqual(boundary === "commit-marker" ? [oldRecord, newRecord] : [oldRecord])
      expect(rebooted.recovery).toEqual({ reason: null, status: "recovered" })
      journalBoundaryCases += 1
      if (boundary === "commit-marker") {
        journalNewRecoveries += 1
      } else {
        journalOldRecoveries += 1
      }
    }

    const invalidStorage = createVirtualEventJournalStorage()
    const invalidJournal = createEventJournal({ maxRecords: SEED_FIXTURE.maxJournalRecords, storage: invalidStorage })
    expect(() => invalidJournal.append(invalidRecord(oldRecord, iteration) as DecisionRecord)).toThrow()
    expect(invalidStorage.writes).toEqual([])
    expect(invalidJournal.records).toEqual([])
  }

  return { journalBoundaryCases, journalNewRecoveries, journalOldRecoveries }
}

function mergeReports(reports: readonly FuzzReport[]): FuzzReport {
  const malformedByCode: Record<string, number> = {}
  return reports.reduce(
    (total, report) => {
      for (const [code, count] of Object.entries(report.malformedByCode)) {
        malformedByCode[code] = (malformedByCode[code] ?? 0) + count
      }
      return {
        acceptedRecords: total.acceptedRecords + report.acceptedRecords,
        duplicateRejections: total.duplicateRejections + report.duplicateRejections,
        invalidDecisionPayloads: total.invalidDecisionPayloads + report.invalidDecisionPayloads,
        journalBoundaryCases: total.journalBoundaryCases + report.journalBoundaryCases,
        journalNewRecoveries: total.journalNewRecoveries + report.journalNewRecoveries,
        journalOldRecoveries: total.journalOldRecoveries + report.journalOldRecoveries,
        malformedByCode,
        maxFrameBytes: Math.max(total.maxFrameBytes, report.maxFrameBytes),
        maxPayloadBytes: Math.max(total.maxPayloadBytes, report.maxPayloadBytes),
        protocolCases: total.protocolCases + report.protocolCases,
        seedCount: total.seedCount + report.seedCount,
        totalIterations: total.totalIterations + report.totalIterations
      }
    },
    {
      acceptedRecords: 0,
      duplicateRejections: 0,
      invalidDecisionPayloads: 0,
      journalBoundaryCases: 0,
      journalNewRecoveries: 0,
      journalOldRecoveries: 0,
      malformedByCode,
      maxFrameBytes: 0,
      maxPayloadBytes: 0,
      protocolCases: 0,
      seedCount: 0,
      totalIterations: 0
    }
  )
}

function runCorpus(): FuzzReport {
  const seeds = assertSeedFixture(SEED_FIXTURE)
  const reports = seeds.map((seed) => {
    const protocol = runSeed(seed, SEED_FIXTURE.iterationsPerSeed)
    const journal = runJournalSeed(seed, SEED_FIXTURE.iterationsPerSeed)
    return { ...protocol, ...journal }
  })
  return mergeReports(reports)
}

function reportDigest(report: FuzzReport): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(report)).digest("hex")}`
}

describe("M2-13 bounded seeded protocol and record fuzz", () => {
  it("uses the checked corpus and reproduces a fixed bounded report", () => {
    const seeds = assertSeedFixture(SEED_FIXTURE)
    expect(seeds).toHaveLength(8)
    expect(SEED_FIXTURE.iterationsPerSeed * seeds.length).toBeLessThanOrEqual(MAX_FUZZ_ITERATIONS)
    const report = runCorpus()

    expect(report).toMatchObject({
      acceptedRecords: 32,
      duplicateRejections: 32,
      invalidDecisionPayloads: 32,
      journalBoundaryCases: 1_024,
      journalNewRecoveries: 256,
      journalOldRecoveries: 768,
      maxFrameBytes: MAX_TRANSPORT_FRAME_BYTES - 2,
      protocolCases: 256,
      seedCount: 8,
      totalIterations: 256
    })
    expect(report.maxPayloadBytes).toBeLessThanOrEqual(MAX_TRANSPORT_PAYLOAD_BYTES)
    expect(report.maxFrameBytes).toBeLessThanOrEqual(MAX_TRANSPORT_FRAME_BYTES)
    expect(report.malformedByCode).toEqual({
      crc: 32,
      direction: 64,
      "message-type": 32,
      "payload-length": 32,
      "trailing-bytes": 32,
      truncated: 32,
      version: 32
    })
    expect(reportDigest(report), JSON.stringify(report)).toBe(SEED_FIXTURE.reportDigest)
  }, 15_000)

  it("keeps maximum protocol inputs bounded and rejects over-limit data before decode or use", () => {
    const maximumPayload = new Uint8Array(SEED_FIXTURE.maxPayloadBytes)
    maximumPayload[0] = 0x53
    maximumPayload[maximumPayload.length - 1] = 0xa5
    const frame = makeFrame("decision-record", 0, maximumPayload)

    expect(frame).toHaveLength(MAX_TRANSPORT_FRAME_BYTES)
    expect(decodeTransportFrame("esp32", frame).payload).toEqual(maximumPayload)
    expect(calculateCrc32c(frame.slice(0, -4))).toBe(
      frame[frame.length - 4]! * 0x1_000000 +
        frame[frame.length - 3]! * 0x1_0000 +
        frame[frame.length - 2]! * 0x100 +
        frame[frame.length - 1]!
    )
    expect(() =>
      encodeTransportFrame({ flags: 0, messageType: "decision-record", payload: new Uint8Array(4_097), sequence: 0 })
    ).toThrow(expect.objectContaining({ code: "payload-length" }))
    expect(() => decodeTransportFrame("esp32", new Uint8Array(MAX_TRANSPORT_FRAME_BYTES + 1))).toThrow(
      expect.objectContaining({ code: "frame-length" })
    )
  })

  it("rejects strict record-shape mutations without durable writes", () => {
    for (const [index, seedText] of SEED_FIXTURE.seeds.entries()) {
      const seed = parseSeed(seedText)
      const record = makeRecord(`shape-${seed.toString(16)}`, seed, index)
      const receiver = createVirtualEsp32({ decodeDecisionRecordPayload: jsonDecoder })
      const malformedPayload = payloadFor(invalidRecord(record, index))
      const receipt = deliver(receiver, "stm32", makeFrame("decision-record", 0, malformedPayload))[0]

      expect(receipt).toMatchObject({ outcome: "rejected", reason: "payload" })
      expect(receiver.records).toEqual([])

      const extraFieldReceiver = createVirtualEsp32({ decodeDecisionRecordPayload: jsonDecoder })
      const extraFieldPayload = payloadFor({ ...record, unexpectedField: true })
      const extraFieldReceipt = deliver(
        extraFieldReceiver,
        "stm32",
        makeFrame("decision-record", 0, extraFieldPayload)
      )[0]
      expect(extraFieldReceipt).toMatchObject({ outcome: "rejected", reason: "payload" })
      expect(extraFieldReceiver.records).toEqual([])
    }
  })
})
