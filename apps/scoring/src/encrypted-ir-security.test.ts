import { createDecipheriv } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  IR_AEAD_SUITE,
  IR_AES_256_GCM_NIST_KAT,
  IR_COMMAND_ID_CAPACITY,
  IR_GLOBAL_RATE_LIMIT_PER_SECOND,
  IR_INGRESS_QUEUE_CAPACITY,
  IR_MAX_WIRE_FRAME_BYTES,
  IR_PER_REMOTE_IDENTITY_RATE_LIMIT_PER_SECOND,
  IR_PROTOCOL_ID,
  IR_PROTOCOL_VERSION,
  IR_REPLAY_AUTHENTICATION_STATUS,
  IR_SECURITY_REVIEW_STATUS,
  IR_WIRE_HEADER_BYTES,
  IR_WIRE_MAGIC_HEX,
  IR_WIRE_PRODUCT_PROTOCOL_HEX,
  IR_WIRE_LAYOUT_BYTES,
  admitIrIngress,
  calculateIrReplayTransition,
  createIrIngressThrottleState,
  createIrReplayState,
  deriveIrAeadNonce,
  parseIrSecureFrame,
  parseIrSecureEnvelope,
  releaseIrIngressSlot,
  serializeIrCanonicalAad,
  serializeIrSecureFrame
} from "./encrypted-ir-security.js"

const pairing = {
  apparatusIdentity: "00112233445566778899aabbccddeeff",
  keyEpoch: 7,
  remoteIdentity: "ffeeddccbbaa99887766554433221100",
  status: "active"
} as const

function frame(overrides: object = {}) {
  return {
    apparatusIdentity: pairing.apparatusIdentity,
    ciphertext: "a1",
    commandId: "11111111111111111111111111111111",
    counter: "0000000000000001",
    keyEpoch: pairing.keyEpoch,
    pressKind: "direct",
    protocolId: IR_PROTOCOL_ID,
    protocolVersion: IR_PROTOCOL_VERSION,
    remoteIdentity: pairing.remoteIdentity,
    suite: IR_AEAD_SUITE,
    tag: "22222222222222222222222222222222",
    ...overrides
  }
}

function candidate(overrides: object = {}) {
  const value = frame(overrides)
  return {
    apparatusIdentity: value.apparatusIdentity,
    commandId: value.commandId,
    counter: value.counter,
    keyEpoch: value.keyEpoch,
    protocolId: value.protocolId,
    protocolVersion: value.protocolVersion,
    remoteIdentity: value.remoteIdentity,
    suite: value.suite
  }
}

function freshReplayState() {
  const receipt = calculateIrReplayTransition(pairing, createIrReplayState(pairing), candidate())
  if (receipt.disposition !== "candidate-fresh") throw new Error("expected a fresh replay candidate")
  return receipt.replayState
}

describe("RC-03 encrypted IR security contract", () => {
  it("freezes one reviewed candidate and exact 150-byte wire accounting pending security review", () => {
    expect(IR_AEAD_SUITE).toBe("AES-256-GCM-96N-128T")
    expect(IR_SECURITY_REVIEW_STATUS).toBe("DENY-independent-security-review")
    expect(Object.values(IR_WIRE_LAYOUT_BYTES).reduce((sum, bytes) => sum + bytes, 0)).toBe(IR_MAX_WIRE_FRAME_BYTES)
    expect(IR_MAX_WIRE_FRAME_BYTES).toBe(150)
    expect(IR_INGRESS_QUEUE_CAPACITY).toBe(4)
    expect(IR_PER_REMOTE_IDENTITY_RATE_LIMIT_PER_SECOND).toBe(24)
    expect(IR_GLOBAL_RATE_LIMIT_PER_SECOND).toBe(64)
  })

  it("accepts only the exact fixed-suite envelope fields and nonce construction", () => {
    expect(parseIrSecureEnvelope(frame())).toEqual(frame())
    expect(() => parseIrSecureEnvelope(frame({ counter: "0000000000000000" }))).toThrow(TypeError)
    expect(() => parseIrSecureEnvelope(frame({ suite: "AES-128-GCM" }))).toThrow(TypeError)
    expect(() => parseIrSecureEnvelope(frame({ tag: "aa" }))).toThrow(TypeError)
    expect(() => parseIrSecureEnvelope({ ...frame(), extra: true })).toThrow(TypeError)
    expect(deriveIrAeadNonce(7, "0000000000000001")).toBe("000000070000000000000001")
    expect(() => deriveIrAeadNonce(7, "0000000000000000")).toThrow(TypeError)
  })

  it("keeps secure-envelope and replay-candidate metadata validation in parity", () => {
    const invalidMetadata = [
      { apparatusIdentity: "00" },
      { commandId: "11" },
      { counter: "0000000000000000" },
      { keyEpoch: 0 },
      { protocolId: "other-ir" },
      { protocolVersion: 2 },
      { remoteIdentity: "ff" },
      { suite: "AES-128-GCM" }
    ]
    const initial = createIrReplayState(pairing)

    for (const overrides of invalidMetadata) {
      expect(() => parseIrSecureEnvelope(frame(overrides))).toThrow(TypeError)
      expect(calculateIrReplayTransition(pairing, initial, candidate(overrides))).toMatchObject({
        disposition: "rejected",
        reason: "malformed-frame"
      })
    }

    expect(() => parseIrSecureEnvelope({ ...frame(), unexpected: true })).toThrow(TypeError)
    expect(calculateIrReplayTransition(pairing, initial, { ...candidate(), unexpected: true })).toMatchObject({
      disposition: "rejected",
      reason: "malformed-frame"
    })
  })

  it("serializes and parses the exact canonical v1 header, AAD, and full-frame vector", () => {
    const aad = serializeIrCanonicalAad(frame())
    const expectedAad =
      "495246534952010100112233445566778899aabbccddeeffffeeddccbbaa99887766554433221100000000070000000000000001111111111111111111111111111111110101"
    expect(aad).toHaveLength(IR_WIRE_HEADER_BYTES)
    expect(Buffer.from(aad).toString("hex")).toBe(expectedAad)
    expect(expectedAad.startsWith(`${IR_WIRE_MAGIC_HEX}${IR_WIRE_PRODUCT_PROTOCOL_HEX}`)).toBe(true)

    const wire = serializeIrSecureFrame(frame())
    expect(Buffer.from(wire).toString("hex")).toBe(`${expectedAad}a1${"22".repeat(16)}`)
    expect(parseIrSecureFrame(wire)).toEqual(frame())

    const wrongMagic = wire.slice()
    wrongMagic[0] ^= 1
    expect(() => parseIrSecureFrame(wrongMagic)).toThrow(TypeError)
    const wrongLength = wire.slice()
    wrongLength[69] = 2
    expect(() => parseIrSecureFrame(wrongLength)).toThrow(TypeError)
    const wrongPressKind = wire.slice()
    wrongPressKind[68] = 255
    expect(() => parseIrSecureFrame(wrongPressKind)).toThrow(TypeError)
  })

  it("keeps raw frames outside the non-authoritative replay calculation", () => {
    const initial = createIrReplayState(pairing)
    expect(calculateIrReplayTransition(pairing, initial, frame())).toMatchObject({
      authority: "non-authoritative",
      dispatchAuthorized: false,
      disposition: "rejected",
      reason: "malformed-frame"
    })
    expect(calculateIrReplayTransition(pairing, initial, { ...candidate(), authenticated: true })).toMatchObject({
      authentication: IR_REPLAY_AUTHENTICATION_STATUS,
      disposition: "rejected",
      reason: "malformed-frame"
    })
    const first = calculateIrReplayTransition(pairing, initial, candidate())
    expect(first).toMatchObject({
      authentication: IR_REPLAY_AUTHENTICATION_STATUS,
      authority: "non-authoritative",
      dispatchAuthorized: false,
      disposition: "candidate-fresh",
      replayState: { highWatermark: "0000000000000001" }
    })
    if (first.disposition !== "candidate-fresh") throw new Error("expected fresh replay candidate")
    expect(first.replayState).not.toBe(initial)
    expect(Object.isFrozen(first.replayState)).toBe(true)
    expect(Object.isFrozen(first.replayState.remembered)).toBe(true)
    expect(first.replayState.remembered.every((entry) => Object.isFrozen(entry))).toBe(true)

    expect(calculateIrReplayTransition(pairing, first.replayState, candidate())).toEqual({
      authentication: IR_REPLAY_AUTHENTICATION_STATUS,
      authority: "non-authoritative",
      dispatchAuthorized: false,
      disposition: "duplicate",
      reason: null,
      replayState: first.replayState
    })
  })

  it("rejects replays, command-id reuse, and cross-pair replay state without mutation", () => {
    const state = freshReplayState()
    expect(
      calculateIrReplayTransition(pairing, state, candidate({ commandId: "33333333333333333333333333333333" }))
    ).toMatchObject({ disposition: "rejected", reason: "replayed", replayState: state })
    expect(calculateIrReplayTransition(pairing, state, candidate({ counter: "0000000000000002" }))).toMatchObject({
      disposition: "rejected",
      reason: "command-id-reused",
      replayState: state
    })
    const otherPairing = { ...pairing, apparatusIdentity: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }
    const decodedState = { ...state, remembered: state.remembered.map((entry) => ({ ...entry })) }
    const crossPairReceipt = calculateIrReplayTransition(otherPairing, decodedState, candidate())
    expect(crossPairReceipt).toMatchObject({
      disposition: "rejected",
      reason: "state-binding-mismatch",
      replayState: state
    })
    expect(crossPairReceipt.replayState).not.toBe(decodedState)
    expect(Object.isFrozen(crossPairReceipt.replayState)).toBe(true)
    expect(Object.isFrozen(crossPairReceipt.replayState?.remembered)).toBe(true)
  })

  it("rejects revoked, wrong-identity, wrong-epoch, and unavailable state before a transition", () => {
    const state = createIrReplayState(pairing)
    expect(calculateIrReplayTransition({ ...pairing, status: "revoked" }, state, candidate())).toMatchObject({
      disposition: "rejected",
      reason: "revoked-pairing"
    })
    expect(calculateIrReplayTransition(pairing, state, candidate({ keyEpoch: 8 }))).toMatchObject({
      disposition: "rejected",
      reason: "wrong-key-epoch"
    })
    expect(
      calculateIrReplayTransition(pairing, state, candidate({ remoteIdentity: "00000000000000000000000000000000" }))
    ).toMatchObject({ disposition: "rejected", reason: "wrong-pairing" })
    expect(calculateIrReplayTransition(pairing, null, candidate())).toEqual({
      authentication: IR_REPLAY_AUTHENTICATION_STATUS,
      authority: "non-authoritative",
      dispatchAuthorized: false,
      disposition: "rejected",
      reason: "state-unavailable",
      replayState: null
    })
  })

  it("fails closed on sparse, accessor-like, out-of-order, or duplicate replay ledger entries", () => {
    const state = freshReplayState()
    const sparse: unknown[] = []
    sparse.length = 1
    expect(calculateIrReplayTransition(pairing, { ...state, remembered: sparse }, candidate())).toMatchObject({
      disposition: "rejected",
      reason: "state-unavailable"
    })
    const extraProperty = [...state.remembered]
    Object.defineProperty(extraProperty, "unexpected", { enumerable: true, value: true })
    expect(calculateIrReplayTransition(pairing, { ...state, remembered: extraProperty }, candidate())).toMatchObject({
      disposition: "rejected",
      reason: "state-unavailable"
    })
    const ordered = [
      { commandId: "22222222222222222222222222222222", counter: "0000000000000002" },
      { commandId: "11111111111111111111111111111111", counter: "0000000000000001" }
    ]
    expect(
      calculateIrReplayTransition(
        pairing,
        { ...state, highWatermark: "0000000000000002", remembered: ordered },
        candidate()
      )
    ).toMatchObject({ disposition: "rejected", reason: "state-unavailable" })
    const duplicateCounter = [
      { commandId: "11111111111111111111111111111111", counter: "0000000000000001" },
      { commandId: "22222222222222222222222222222222", counter: "0000000000000001" }
    ]
    expect(calculateIrReplayTransition(pairing, { ...state, remembered: duplicateCounter }, candidate())).toMatchObject(
      { disposition: "rejected", reason: "state-unavailable" }
    )
  })

  it("halts fresh commands at the durable command-id capacity rather than evicting identity history", () => {
    const remembered = Array.from({ length: IR_COMMAND_ID_CAPACITY }, (_, index) => ({
      commandId: (index + 1).toString(16).padStart(32, "0"),
      counter: (index + 1).toString(16).padStart(16, "0")
    }))
    const capacityState = {
      ...createIrReplayState(pairing),
      highWatermark: IR_COMMAND_ID_CAPACITY.toString(16).padStart(16, "0"),
      remembered
    }
    expect(
      calculateIrReplayTransition(
        pairing,
        capacityState,
        candidate({
          commandId: "ffffffffffffffffffffffffffffffff",
          counter: (IR_COMMAND_ID_CAPACITY + 1).toString(16).padStart(16, "0")
        })
      )
    ).toMatchObject({ disposition: "rejected", reason: "command-id-capacity-exhausted", replayState: capacityState })
  })

  it("enforces bounded queue, pair rate, global rate, release, and monotonic ingress time", () => {
    let queueState = createIrIngressThrottleState(100)
    for (let index = 0; index < IR_INGRESS_QUEUE_CAPACITY; index += 1) {
      const admitted = admitIrIngress(queueState, pairing.remoteIdentity, 100)
      if (admitted.disposition !== "admitted") throw new Error("expected queue admission")
      queueState = admitted.state
    }
    expect(admitIrIngress(queueState, pairing.remoteIdentity, 100)).toMatchObject({
      disposition: "rejected",
      reason: "queue-capacity-exhausted"
    })
    const released = releaseIrIngressSlot(queueState)
    if (released.disposition !== "released") throw new Error("expected queue release")
    expect(admitIrIngress(released.state, pairing.remoteIdentity, 99)).toMatchObject({
      disposition: "rejected",
      reason: "clock-regression"
    })

    let pairRateState = createIrIngressThrottleState(0)
    for (let index = 0; index < IR_PER_REMOTE_IDENTITY_RATE_LIMIT_PER_SECOND; index += 1) {
      const admitted = admitIrIngress(pairRateState, pairing.remoteIdentity, 0)
      if (admitted.disposition !== "admitted") throw new Error("expected pair-rate admission")
      const releasedPair = releaseIrIngressSlot(admitted.state)
      if (releasedPair.disposition !== "released") throw new Error("expected pair-rate release")
      pairRateState = releasedPair.state
    }
    expect(admitIrIngress(pairRateState, pairing.remoteIdentity, 0)).toMatchObject({
      disposition: "rejected",
      reason: "rate-limited"
    })

    let globalRateState = createIrIngressThrottleState(0)
    for (let index = 0; index < IR_GLOBAL_RATE_LIMIT_PER_SECOND; index += 1) {
      const remoteIdentity = index.toString(16).padStart(32, "0")
      const admitted = admitIrIngress(globalRateState, remoteIdentity, 0)
      if (admitted.disposition !== "admitted") throw new Error("expected global-rate admission")
      const releasedGlobal = releaseIrIngressSlot(admitted.state)
      if (releasedGlobal.disposition !== "released") throw new Error("expected global-rate release")
      globalRateState = releasedGlobal.state
    }
    expect(admitIrIngress(globalRateState, "ffffffffffffffffffffffffffffffff", 0)).toMatchObject({
      disposition: "rejected",
      reason: "rate-limited"
    })
  })

  it("keeps the public NIST AES-256-GCM known-answer vector as a crypto-library gate", () => {
    const vector = IR_AES_256_GCM_NIST_KAT
    function decrypt(aad: string, tag: string) {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        Buffer.from(vector.key, "hex"),
        Buffer.from(vector.nonce, "hex"),
        { authTagLength: 16 }
      )
      decipher.setAAD(Buffer.from(aad, "hex"))
      decipher.setAuthTag(Buffer.from(tag, "hex"))
      return Buffer.concat([decipher.update(Buffer.from(vector.ciphertext, "hex")), decipher.final()])
    }
    expect(decrypt(vector.aad, vector.tag)).toEqual(Buffer.from(vector.plaintext, "hex"))
    expect(() => decrypt(`${vector.aad.slice(0, -2)}00`, vector.tag)).toThrow()
    expect(() => {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        Buffer.from(vector.key, "hex"),
        Buffer.from(vector.nonce, "hex"),
        { authTagLength: 16 }
      )
      decipher.setAAD(Buffer.from(vector.aad, "hex"))
      decipher.setAuthTag(Buffer.from(vector.tag, "hex"))
      const alteredCiphertext = Buffer.from(vector.ciphertext, "hex")
      alteredCiphertext[0] ^= 1
      Buffer.concat([decipher.update(alteredCiphertext), decipher.final()])
    }).toThrow()
    expect(() => decrypt(vector.aad, `${vector.tag.slice(0, -2)}00`)).toThrow()
  })
})

describe("IR wire and ingress boundary failures", () => {
  it("round-trips every press code and rejects malformed wire buffers", () => {
    for (const pressKind of ["direct", "modified", "held", "double"]) {
      expect(parseIrSecureFrame(serializeIrSecureFrame(frame({ pressKind })))).toEqual(frame({ pressKind }))
    }
    for (const value of [null, [], new Uint8Array(0), new Uint8Array(151)])
      expect(() => parseIrSecureFrame(value)).toThrow(TypeError)
    for (const offset of [2, 6, 7]) {
      const wire = serializeIrSecureFrame(frame())
      wire[offset] = 255
      expect(() => parseIrSecureFrame(wire)).toThrow(TypeError)
    }
    expect(() => createIrReplayState({})).toThrow(TypeError)
    expect(calculateIrReplayTransition({}, createIrReplayState(pairing), candidate())).toMatchObject({
      reason: "malformed-frame"
    })
  })

  it("rejects invalid and contradictory throttle states", () => {
    expect(() => createIrIngressThrottleState(-1)).toThrow(TypeError)
    const initial = createIrIngressThrottleState(10)
    for (const state of [
      null,
      {},
      { ...initial, globalWindowCount: 65 },
      { ...initial, queuedFrameCount: 5 },
      { ...initial, remoteWindowCounts: [{ count: 0, remoteIdentity: pairing.remoteIdentity }] },
      { ...initial, remoteWindowCounts: [{ count: 1, remoteIdentity: "invalid" }] }
    ]) {
      expect(admitIrIngress(state, pairing.remoteIdentity, 10)).toMatchObject({
        reason: "invalid-ingress",
        state: null
      })
      expect(releaseIrIngressSlot(state)).toMatchObject({ reason: "invalid-ingress", state: null })
    }
    expect(releaseIrIngressSlot(initial)).toMatchObject({ reason: "invalid-ingress" })
    expect(admitIrIngress(initial, "invalid", 10)).toMatchObject({ reason: "invalid-ingress" })
    expect(admitIrIngress(initial, pairing.remoteIdentity, -1)).toMatchObject({ reason: "invalid-ingress" })
    expect(admitIrIngress(initial, pairing.remoteIdentity, 9)).toMatchObject({ reason: "clock-regression" })
    const restarted = admitIrIngress(initial, pairing.remoteIdentity, 1_000_010)
    expect(restarted).toMatchObject({
      disposition: "admitted",
      state: { windowStartedAtUs: 1_000_010, globalWindowCount: 1 }
    })
    const multi = {
      ...initial,
      globalWindowCount: 2,
      remoteWindowCounts: [
        { count: 1, remoteIdentity: pairing.remoteIdentity },
        { count: 1, remoteIdentity: pairing.apparatusIdentity }
      ]
    }
    expect(admitIrIngress(multi, pairing.remoteIdentity, 10)).toMatchObject({
      disposition: "admitted",
      state: {
        remoteWindowCounts: [
          { count: 2, remoteIdentity: pairing.remoteIdentity },
          { count: 1, remoteIdentity: pairing.apparatusIdentity }
        ]
      }
    })
  })
})

it("rejects sparse replay arrays and non-enumerable replay entries", () => {
  const empty = createIrReplayState(pairing)
  for (const remembered of [
    Array(1),
    Object.defineProperty([{ commandId: frame().commandId, counter: frame().counter }], "0", { enumerable: false })
  ]) {
    expect(calculateIrReplayTransition(pairing, { ...empty, remembered }, candidate())).toMatchObject({
      reason: "state-unavailable"
    })
  }
})

it("rejects descriptor-free replay state arrays", () => {
  const remembered = new Proxy([], {
    getPrototypeOf() {
      return null
    }
  })
  expect(
    calculateIrReplayTransition(pairing, { ...createIrReplayState(pairing), remembered }, candidate())
  ).toMatchObject({ reason: "state-unavailable" })
})
