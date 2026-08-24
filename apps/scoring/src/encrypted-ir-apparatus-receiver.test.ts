import { createCipheriv, createDecipheriv } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  IR_COMMAND_PAYLOAD_VERSION,
  createEncryptedIrApparatusReceiver,
  decodeIrCompactCommandPayload,
  encodeIrCompactCommandPayload
} from "./encrypted-ir-apparatus-receiver.js"
import {
  createIrIngressThrottleState,
  deriveIrAeadNonce,
  serializeIrCanonicalAad,
  serializeIrSecureFrame,
  type IrSecureEnvelope
} from "./encrypted-ir-security.js"

const binding = {
  authorityRevision: 3,
  controllerId: "remote.controller.alpha",
  pairing: {
    apparatusIdentity: "000102030405060708090a0b0c0d0e0f",
    keyEpoch: 1,
    remoteIdentity: "101112131415161718191a1b1c1d1e1f",
    status: "active"
  },
  permission: "referee",
  remoteId: "remote.alpha"
} as const

const PUBLIC_TEST_VECTOR_KEY_HEX = "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308"

function envelopeFor(
  command: Parameters<typeof encodeIrCompactCommandPayload>[0],
  overrides: Partial<IrSecureEnvelope> = {}
): Uint8Array {
  const metadata = {
    apparatusIdentity: binding.pairing.apparatusIdentity,
    commandId: "202122232425262728292a2b2c2d2e2f",
    counter: "0000000000000001",
    keyEpoch: binding.pairing.keyEpoch,
    pressKind: "direct",
    protocolId: "fencing-ir",
    protocolVersion: 1,
    remoteIdentity: binding.pairing.remoteIdentity,
    suite: "AES-256-GCM-96N-128T",
    ...overrides
  } as const
  const plaintext = encodeIrCompactCommandPayload(command)
  const candidate = { ...metadata, ciphertext: "00".repeat(plaintext.length), tag: "00".repeat(16) }
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(PUBLIC_TEST_VECTOR_KEY_HEX, "hex"),
    Buffer.from(deriveIrAeadNonce(candidate.keyEpoch, candidate.counter), "hex"),
    { authTagLength: 16 }
  )
  cipher.setAAD(Buffer.from(serializeIrCanonicalAad(candidate)))
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return serializeIrSecureFrame({
    ...candidate,
    ciphertext: ciphertext.toString("hex"),
    tag: cipher.getAuthTag().toString("hex")
  })
}

function cryptoAdapter() {
  return {
    async decryptAuthenticated(
      input: Readonly<{
        aad: Uint8Array
        ciphertext: Uint8Array
        nonce: Uint8Array
        tag: Uint8Array
      }>
    ): Promise<Uint8Array | null> {
      try {
        const nodeDecipher = createDecipheriv(
          "aes-256-gcm",
          Buffer.from(PUBLIC_TEST_VECTOR_KEY_HEX, "hex"),
          input.nonce,
          { authTagLength: 16 }
        )
        nodeDecipher.setAAD(input.aad)
        nodeDecipher.setAuthTag(input.tag)
        return new Uint8Array(Buffer.concat([nodeDecipher.update(input.ciphertext), nodeDecipher.final()]))
      } catch {
        return null
      }
    }
  }
}

function receiver(dispatched: unknown[] = []) {
  return createEncryptedIrApparatusReceiver({
    bindings: [binding],
    crypto: cryptoAdapter(),
    dispatch(command) {
      dispatched.push(command)
    }
  })
}

function createUnchecked(value: unknown) {
  return Reflect.apply(createEncryptedIrApparatusReceiver, undefined, [value])
}

function mutableClone(value: unknown) {
  return JSON.parse(JSON.stringify(value))
}

function validOptions() {
  return {
    bindings: [mutableClone(binding)],
    crypto: cryptoAdapter(),
    dispatch() {}
  }
}

describe("RC-13 encrypted IR apparatus receiver", () => {
  it("uses only the fixed v1 direct command codec", () => {
    expect(IR_COMMAND_PAYLOAD_VERSION).toBe(1)
    expect(encodeIrCompactCommandPayload("score.increment.left")).toEqual(Uint8Array.of(1, 1))
    expect(decodeIrCompactCommandPayload(Uint8Array.of(1, 16))).toBe("cards.reset")
    expect(() => encodeIrCompactCommandPayload("clock.configure")).toThrow(TypeError)
    expect(() => encodeIrCompactCommandPayload("modifier.opt")).toThrow(TypeError)
    expect(() => decodeIrCompactCommandPayload(Uint8Array.of(2, 1))).toThrow(TypeError)
    expect(() => decodeIrCompactCommandPayload(Uint8Array.of(1, 14))).toThrow(TypeError)
    expect(() => decodeIrCompactCommandPayload(Uint8Array.of(1, 255))).toThrow(TypeError)
    expect(() => decodeIrCompactCommandPayload(Uint8Array.of(1, 1, 0))).toThrow(TypeError)
  })

  it("preflights option graphs before reading them and rejects malformed containers, aliases, and cycles", () => {
    const accessor = validOptions()
    Object.defineProperty(accessor, "bindings", {
      enumerable: true,
      get() {
        return [binding]
      }
    })
    expect(() => createUnchecked(accessor)).toThrow(TypeError)

    const hidden = validOptions()
    Object.defineProperty(hidden, "hidden", { enumerable: false, value: true })
    expect(() => createUnchecked(hidden)).toThrow(TypeError)

    const symbolKey = validOptions()
    Object.defineProperty(symbolKey, Symbol("unexpected"), { enumerable: true, value: true })
    expect(() => createUnchecked(symbolKey)).toThrow(TypeError)

    const sparse: unknown[] = []
    sparse.length = 1
    expect(() => createUnchecked({ ...validOptions(), bindings: sparse })).toThrow(TypeError)

    class BindingArray extends Array {}
    const subclassed = new BindingArray()
    subclassed.push(mutableClone(binding))
    expect(() => createUnchecked({ ...validOptions(), bindings: subclassed })).toThrow(TypeError)

    const sharedPairing = mutableClone(binding.pairing)
    const aliases = validOptions()
    aliases.bindings = [
      { ...mutableClone(binding), pairing: sharedPairing },
      {
        ...mutableClone(binding),
        controllerId: "remote.controller.beta",
        pairing: sharedPairing,
        remoteId: "remote.beta"
      }
    ]
    expect(() => createUnchecked(aliases)).toThrow(TypeError)

    const cyclic: Record<string, unknown> = validOptions()
    cyclic.self = cyclic
    expect(() => createUnchecked(cyclic)).toThrow(TypeError)
  })

  it("canonicalizes supplied state, rejects binding mismatches, and retains no caller state references", async () => {
    const first = receiver()
    await first.receive(envelopeFor("score.increment.left"), 0)
    const initialReplayStates = mutableClone(first.replayStates)
    const initialThrottleState = mutableClone(createIrIngressThrottleState(0))
    const restored = createEncryptedIrApparatusReceiver({
      ...validOptions(),
      initialReplayStates,
      initialThrottleState
    })
    expect(restored.replayStates[0]).not.toBe(initialReplayStates[0])
    expect(restored.replayStates[0]?.remembered).not.toBe(initialReplayStates[0]?.remembered)
    expect(Object.isFrozen(restored.replayStates[0])).toBe(true)
    expect(Object.isFrozen(restored.throttleState)).toBe(true)
    initialReplayStates[0]!.remembered[0]!.counter = "0000000000000002"
    initialThrottleState.windowStartedAtUs = 100
    expect(restored.replayStates[0]?.remembered[0]?.counter).toBe("0000000000000001")
    expect(restored.throttleState.windowStartedAtUs).toBe(0)

    const exact = mutableClone(first.replayStates[0])
    const wrongApparatus = mutableClone(exact)
    wrongApparatus.apparatusIdentity = "ffffffffffffffffffffffffffffffff"
    expect(() => createUnchecked({ ...validOptions(), initialReplayStates: [wrongApparatus] })).toThrow(TypeError)
    const wrongProtocol = mutableClone(exact)
    wrongProtocol.protocolVersion = 2
    expect(() => createUnchecked({ ...validOptions(), initialReplayStates: [wrongProtocol] })).toThrow(TypeError)
    const wrongEpoch = mutableClone(exact)
    wrongEpoch.keyEpoch = 2
    expect(() => createUnchecked({ ...validOptions(), initialReplayStates: [wrongEpoch] })).toThrow(TypeError)
    const invalidCheckpoint = mutableClone(exact)
    invalidCheckpoint.remembered[0]!.counter = "0000000000000002"
    expect(() => createUnchecked({ ...validOptions(), initialReplayStates: [invalidCheckpoint] })).toThrow(TypeError)

    const queued = mutableClone(createIrIngressThrottleState(0))
    queued.queuedFrameCount = 1
    expect(() => createUnchecked({ ...validOptions(), initialThrottleState: queued })).toThrow(TypeError)
    const duplicateRemoteCounts = mutableClone(createIrIngressThrottleState(0))
    duplicateRemoteCounts.remoteWindowCounts = [
      { count: 1, remoteIdentity: binding.pairing.remoteIdentity },
      { count: 1, remoteIdentity: binding.pairing.remoteIdentity }
    ]
    expect(() => createUnchecked({ ...validOptions(), initialThrottleState: duplicateRemoteCounts })).toThrow(TypeError)
  })

  it("authenticates, binds the paired identity, commits replay state, and dispatches one logical command", async () => {
    const dispatched: unknown[] = []
    const service = receiver(dispatched)
    const result = await service.receive(envelopeFor("score.increment.left"), 10)
    expect(result).toMatchObject({ disposition: "accepted", reason: null })
    expect(result.command).toMatchObject({
      apparatusId: binding.pairing.apparatusIdentity,
      authority: { controllerId: binding.controllerId, kind: "paired-handheld", permission: "referee" },
      command: "score.increment.left",
      commandId: "202122232425262728292a2b2c2d2e2f",
      counter: 1,
      payload: {},
      pressKind: "direct",
      remoteId: binding.remoteId
    })
    expect(dispatched).toEqual([result.command])
    expect(service.replayStates[0]?.highWatermark).toBe("0000000000000001")
  })

  it("rejects malformed, wrong-key, wrong-pairing, unauthenticated, and invalid-payload inputs before dispatch", async () => {
    const dispatched: unknown[] = []
    const service = receiver(dispatched)
    const valid = envelopeFor("score.increment.left")
    const wrongKey = envelopeFor("score.increment.left", { keyEpoch: 2 })
    const wrongPairing = envelopeFor("score.increment.left", {
      apparatusIdentity: "f00102030405060708090a0b0c0d0e0f"
    })
    const corruptTag = valid.slice()
    corruptTag[corruptTag.length - 1] ^= 1
    const unsupportedVersion = valid.slice()
    unsupportedVersion[6] = 2
    const invalidPayload = envelopeFor("score.increment.left")
    const decoder = createEncryptedIrApparatusReceiver({
      bindings: [binding],
      crypto: {
        async decryptAuthenticated() {
          return Uint8Array.of(1, 255)
        }
      },
      dispatch(command) {
        dispatched.push(command)
      }
    })

    await expect(service.receive(Uint8Array.of(1), 0)).resolves.toMatchObject({ reason: "malformed-frame" })
    await expect(service.receive(unsupportedVersion, 1)).resolves.toMatchObject({ reason: "malformed-frame" })
    await expect(service.receive(wrongKey, 2)).resolves.toMatchObject({ reason: "wrong-key-epoch" })
    await expect(service.receive(wrongPairing, 3)).resolves.toMatchObject({ reason: "wrong-pairing" })
    await expect(service.receive(corruptTag, 4)).resolves.toMatchObject({ reason: "authentication-failed" })
    await expect(decoder.receive(invalidPayload, 0)).resolves.toMatchObject({ reason: "invalid-payload" })
    expect(dispatched).toEqual([])
  })

  it("keeps revocation distinct from unknown or mismatched pairing diagnostics", async () => {
    const revoked = mutableClone(binding)
    revoked.pairing.status = "revoked"
    const service = createUnchecked({ ...validOptions(), bindings: [revoked] })
    await expect(service.receive(envelopeFor("score.increment.left"), 0)).resolves.toMatchObject({
      disposition: "rejected",
      reason: "revoked-pairing"
    })
  })

  it("deduplicates bursts, rejects stale counters, and restores replay state across a service reset", async () => {
    const dispatched: unknown[] = []
    const first = receiver(dispatched)
    const initial = envelopeFor("score.increment.left")
    await expect(first.receive(initial, 0)).resolves.toMatchObject({ disposition: "accepted" })
    await expect(first.receive(initial, 1)).resolves.toMatchObject({ disposition: "duplicate" })
    const stale = envelopeFor("score.increment.right", {
      commandId: "303132333435363738393a3b3c3d3e3f",
      counter: "0000000000000001"
    })
    await expect(first.receive(stale, 2)).resolves.toMatchObject({ reason: "replayed" })
    const restored = createEncryptedIrApparatusReceiver({
      bindings: [binding],
      crypto: cryptoAdapter(),
      dispatch(command) {
        dispatched.push(command)
      },
      initialReplayStates: first.replayStates
    })
    await expect(restored.receive(initial, 3)).resolves.toMatchObject({ disposition: "duplicate" })
    const next = envelopeFor("score.increment.right", {
      commandId: "404142434445464748494a4b4c4d4e4f",
      counter: "0000000000000002"
    })
    await expect(restored.receive(next, 4)).resolves.toMatchObject({ disposition: "accepted" })
    expect(dispatched).toHaveLength(2)
  })

  it("applies bounded ingress admission before asynchronous crypto work and releases each slot", async () => {
    const completions: Array<(value: Uint8Array | null) => void> = []
    const service = createEncryptedIrApparatusReceiver({
      bindings: [binding],
      crypto: {
        decryptAuthenticated() {
          return new Promise((resolve) => completions.push(resolve))
        }
      },
      dispatch() {}
    })
    const frames = Array.from({ length: 4 }, (_, index) =>
      envelopeFor("score.increment.left", {
        commandId: (index + 1).toString(16).padStart(32, "0"),
        counter: (index + 1).toString(16).padStart(16, "0")
      })
    )
    const pending = frames.map((frame, index) => service.receive(frame, index))
    await expect(
      service.receive(
        envelopeFor("score.increment.left", {
          commandId: "ffffffffffffffffffffffffffffffff",
          counter: "0000000000000005"
        }),
        5
      )
    ).resolves.toMatchObject({ reason: "throttled" })
    completions.forEach((complete) => complete(Uint8Array.of(1, 1)))
    await expect(Promise.all(pending)).resolves.toHaveLength(4)
    expect(service.throttleState.queuedFrameCount).toBe(0)
  })

  it("fails closed under bounded deterministic frame mutation without leaking dispatch", async () => {
    const dispatched: unknown[] = []
    const service = receiver(dispatched)
    const valid = envelopeFor("score.increment.left")
    let seed = 0x6d2b79f5
    for (let index = 0; index < 64; index += 1) {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      const mutated = valid.slice()
      const offset = Math.abs(seed) % mutated.length
      mutated[offset] ^= (seed >>> 8) & 0xff || 1
      const result = await service.receive(mutated, index)
      expect(result.disposition).not.toBe("accepted")
    }
    expect(dispatched).toEqual([])
  })

  it("does not reopen a committed replay receipt when dispatch fails", async () => {
    const service = createEncryptedIrApparatusReceiver({
      bindings: [binding],
      crypto: cryptoAdapter(),
      dispatch() {
        throw new Error("downstream")
      },
      initialThrottleState: createIrIngressThrottleState(0)
    })
    const valid = envelopeFor("score.increment.left")
    await expect(service.receive(valid, 0)).resolves.toMatchObject({ reason: "dispatch-failed" })
    await expect(service.receive(valid, 1)).resolves.toMatchObject({ disposition: "duplicate" })
  })
})
