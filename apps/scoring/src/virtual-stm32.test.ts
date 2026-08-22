import { describe, expect, it } from "vitest"
import { createVirtualClock } from "./virtual-clock.js"
import {
  advanceVirtualFrontEnd,
  createVirtualFrontEndState,
  type VirtualFrontEndSnapshot
} from "./virtual-front-end.js"
import {
  createVirtualStm32,
  DEFAULT_VIRTUAL_STM32_MAX_SNAPSHOTS,
  MAX_VIRTUAL_STM32_MAX_SNAPSHOTS,
  type VirtualStm32,
  type VirtualStm32WeaponScorer
} from "./virtual-stm32.js"

type TestState = Readonly<{ acceptedAtUs: readonly number[] }>
type TestOutcome = Readonly<{ qualifiedAtUs: number }>

function snapshot(
  atUs: number,
  trust: "available" | "indeterminate" | "unavailable" = "available"
): VirtualFrontEndSnapshot {
  const state = advanceVirtualFrontEnd(createVirtualFrontEndState(), {
    atUs,
    phase:
      trust === "available"
        ? {
            excitation: { owner: "left.A", state: "active" },
            id: "epee-tip-loop",
            perspective: "affected-side",
            safeInactive: false,
            side: "left",
            status: "available"
          }
        : {
            excitation: { owner: null, state: "inactive" },
            id: "epee-tip-loop",
            perspective: "affected-side",
            safeInactive: true,
            side: "left",
            status: trust
          },
    relations: []
  })

  return state.current!
}

function snapshotWithRelation(): VirtualFrontEndSnapshot {
  const state = advanceVirtualFrontEnd(createVirtualFrontEndState(), {
    atUs: 8,
    phase: {
      excitation: { owner: "left.A", state: "active" },
      id: "epee-tip-loop",
      perspective: "affected-side",
      safeInactive: false,
      side: "left",
      status: "available"
    },
    relations: [
      {
        endpoints: ["left.A", "left.B"],
        faultCode: null,
        id: "tip-loop",
        provenance: { observedAtUs: 8, sourceId: "fixture" },
        resistanceMilliOhms: 0,
        resistanceUncertaintyMilliOhms: 0,
        state: "closed"
      }
    ]
  })

  return state.current!
}

function scorer(weapon: "epee" | "foil" | "sabre" = "foil"): VirtualStm32WeaponScorer<TestState, TestOutcome> {
  return {
    advance: (state, input, context) => ({
      outcome: input.atUs % 2 === 0 ? { qualifiedAtUs: context.atUs } : null,
      state: { acceptedAtUs: [...state.acceptedAtUs, context.atUs] }
    }),
    createState: () => ({ acceptedAtUs: [] }),
    weapon
  }
}

describe("virtual STM32", () => {
  it("selects a weapon and immutable timing table, and emits only weapon-scorer outcomes on virtual time", () => {
    const clock = createVirtualClock()
    const observed: unknown[] = []
    const shell = createVirtualStm32({
      clock,
      onAuthoritativeOutcome: (outcome) => observed.push(outcome),
      scorer: scorer(),
      timingTableRevision: "timing-1",
      weapon: "foil"
    })

    clock.scheduleAt(12, () => observed.push("before-shell"))
    const first = shell.ingestSnapshot(snapshot(12))
    const second = shell.ingestSnapshot(snapshot(13))

    expect(shell.clock).toBe(clock)
    expect(shell.weapon).toBe("foil")
    expect(shell.timingTableRevision).toBe("timing-1")
    expect(first).toEqual({
      atUs: 12,
      outcome: {
        atUs: 12,
        outcome: { qualifiedAtUs: 12 },
        source: "weapon-scorer",
        timingTableRevision: "timing-1",
        weapon: "foil"
      },
      status: "scored"
    })
    expect(second).toEqual({ atUs: 13, outcome: null, status: "scored" })
    expect(observed).toEqual(["before-shell", first.outcome])
    expect(shell.processedSnapshotCount).toBe(2)
    expect(shell.lastReceipt).toBe(second)
    expect(clock.currentAtUs).toBe(13)
    expect(Object.isFrozen(first.outcome)).toBe(true)
  })

  it("is deterministic and only admits trusted canonical front-end snapshots to its weapon scorer", () => {
    const replay = () => {
      const invokedAtUs: number[] = []
      const shell = createVirtualStm32({
        scorer: {
          advance: (state, input, context) => {
            invokedAtUs.push(input.atUs)
            return {
              outcome: { qualifiedAtUs: context.atUs },
              state: { acceptedAtUs: [...state.acceptedAtUs, context.atUs] }
            }
          },
          createState: (): TestState => ({ acceptedAtUs: [] }),
          weapon: "sabre"
        },
        timingTableRevision: "timing-1",
        weapon: "sabre"
      })
      const receipts = [shell.ingestSnapshot(snapshot(3, "indeterminate")), shell.ingestSnapshot(snapshot(4))]
      return { invokedAtUs, receipts }
    }

    const first = replay()
    const second = replay()
    expect(first).toEqual({
      invokedAtUs: [4],
      receipts: [
        { atUs: 3, outcome: null, status: "ignored-untrusted" },
        {
          atUs: 4,
          outcome: {
            atUs: 4,
            outcome: { qualifiedAtUs: 4 },
            source: "weapon-scorer",
            timingTableRevision: "timing-1",
            weapon: "sabre"
          },
          status: "scored"
        }
      ]
    })
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
  })

  it("fails closed for invalid selection, application-shaped input, unsafe times, and invalid scorer behavior", () => {
    expect(() =>
      createVirtualStm32({
        scorer: scorer("epee"),
        timingTableRevision: "timing-1",
        weapon: "foil"
      })
    ).toThrow(new RangeError("Virtual STM32 scorer weapon must match the selected weapon"))
    expect(() =>
      createVirtualStm32({ scorer: scorer(), timingTableRevision: "unknown" as "timing-1", weapon: "foil" })
    ).toThrow(new RangeError("Unknown timing-table revision"))
    expect(() => createVirtualStm32(null as never)).toThrow(new TypeError("Virtual STM32 options must be an object"))
    expect(() =>
      createVirtualStm32({ scorer: scorer(), timingTableRevision: "timing-1", weapon: "foil", decision: {} } as never)
    ).toThrow(new TypeError("Virtual STM32 options has unrecognized fields"))
    expect(() =>
      createVirtualStm32({ scorer: scorer(), timingTableRevision: "timing-1", weapon: "other" as never })
    ).toThrow(new TypeError("Virtual STM32 weapon must be epee, foil, or sabre"))
    expect(() =>
      createVirtualStm32({ scorer: { weapon: "foil" } as never, timingTableRevision: "timing-1", weapon: "foil" })
    ).toThrow(new TypeError("Virtual STM32 scorer must provide a weapon, state factory, and advance function"))
    expect(() =>
      createVirtualStm32({ clock: {} as never, scorer: scorer(), timingTableRevision: "timing-1", weapon: "foil" })
    ).toThrow(new TypeError("Virtual STM32 clock must be a virtual clock"))
    expect(() =>
      createVirtualStm32({
        onAuthoritativeOutcome: "not-a-function" as never,
        scorer: scorer(),
        timingTableRevision: "timing-1",
        weapon: "foil"
      })
    ).toThrow(new TypeError("Virtual STM32 authoritative outcome observers must be functions"))
    expect(() =>
      createVirtualStm32({ maxSnapshots: 0, scorer: scorer(), timingTableRevision: "timing-1", weapon: "foil" })
    ).toThrow()
    expect(() =>
      createVirtualStm32({
        maxSnapshots: MAX_VIRTUAL_STM32_MAX_SNAPSHOTS + 1,
        scorer: scorer(),
        timingTableRevision: "timing-1",
        weapon: "foil"
      })
    ).toThrow()
    expect(DEFAULT_VIRTUAL_STM32_MAX_SNAPSHOTS).toBe(100_000)

    const shell = createVirtualStm32({ scorer: scorer(), timingTableRevision: "timing-1", weapon: "foil" })
    expect(() => shell.ingestSnapshot(null as never)).toThrow(
      new TypeError("Virtual STM32 snapshots must be canonical virtual front-end snapshots")
    )
    expect(() => shell.ingestSnapshot({ ...snapshot(1), decision: { outcome: "hit" } } as never)).toThrow(
      new TypeError("Virtual STM32 snapshots has missing or unrecognized fields")
    )
    expect(() => shell.ingestSnapshot({ ...snapshot(1), trust: "unknown" } as never)).toThrow(
      new TypeError("Virtual STM32 snapshots must declare front-end trust")
    )
    const canonical = snapshotWithRelation()
    expect(() =>
      shell.ingestSnapshot({
        ...canonical,
        phase: { ...canonical.phase, excitation: { owner: "not-a-conductor", state: "active" } }
      } as never)
    ).toThrow()
    expect(() =>
      shell.ingestSnapshot({
        ...canonical,
        relations: [
          {
            ...canonical.relations[0]!,
            resistance: { ...canonical.relations[0]!.resistance, bucket: "interval" }
          }
        ]
      })
    ).toThrow(
      new RangeError("Virtual front-end snapshots must preserve canonical phase, relations, contradictions, and trust")
    )
    expect(() =>
      shell.ingestSnapshot({
        ...canonical,
        transitions: [
          {
            ...canonical.transitions[0]!,
            next: { ...canonical.transitions[0]!.next!, state: "open" }
          }
        ]
      })
    ).toThrow(new RangeError("Added virtual front-end transitions must introduce the current relation"))
    expect(() => shell.ingestSnapshot({ ...snapshot(1), atUs: -1 })).toThrow(
      new RangeError("Virtual STM32 snapshot timestamps must be a non-negative safe integer")
    )
    shell.ingestSnapshot(snapshot(2))
    expect(() => shell.ingestSnapshot(snapshot(1))).toThrow(
      new RangeError("Virtual STM32 snapshots must use monotonic timestamps")
    )

    const advancedClock = createVirtualClock({ startAtUs: 10 })
    const clockShell = createVirtualStm32({
      clock: advancedClock,
      scorer: scorer(),
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    expect(() => clockShell.ingestSnapshot(snapshot(9))).toThrow(
      new RangeError("Virtual STM32 snapshots cannot precede the virtual clock")
    )

    const malformedScorer = createVirtualStm32({
      scorer: {
        advance: () => ({ outcome: undefined, state: {} }),
        createState: () => ({}),
        weapon: "foil"
      },
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    expect(() => malformedScorer.ingestSnapshot(snapshot(0))).toThrow(
      new TypeError("Virtual STM32 scorer outcomes must be an outcome or null")
    )

    const nonRecordAdvance = createVirtualStm32({
      scorer: { advance: () => null as never, createState: () => ({}), weapon: "foil" },
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    expect(() => nonRecordAdvance.ingestSnapshot(snapshot(0))).toThrow(
      new TypeError("Virtual STM32 scorers must return a state and an outcome")
    )
  })

  it("bounds snapshots and rejects asynchronous or reentrant scoring work", () => {
    const boundedShell = createVirtualStm32({
      maxSnapshots: 1,
      scorer: scorer(),
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    boundedShell.ingestSnapshot(snapshot(0))
    expect(() => boundedShell.ingestSnapshot(snapshot(1))).toThrow(
      new RangeError("Virtual STM32 snapshot limit of 1 reached")
    )

    const asynchronousScorer = createVirtualStm32({
      scorer: {
        advance: () => Promise.resolve({ outcome: null, state: {} }) as never,
        createState: () => ({}),
        weapon: "foil"
      },
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    expect(() => asynchronousScorer.ingestSnapshot(snapshot(0))).toThrow(
      new TypeError("Virtual STM32 scorers must complete synchronously")
    )

    expect(() =>
      createVirtualStm32({
        scorer: {
          advance: () => ({ outcome: null, state: {} }),
          createState: () => Promise.resolve({}) as never,
          weapon: "foil"
        },
        timingTableRevision: "timing-1",
        weapon: "foil"
      })
    ).toThrow(new TypeError("Virtual STM32 scorer state factories must complete synchronously"))

    let shell: VirtualStm32<TestOutcome>
    shell = createVirtualStm32({
      onAuthoritativeOutcome: () => shell.ingestSnapshot(snapshot(0)),
      scorer: scorer(),
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    expect(() => shell.ingestSnapshot(snapshot(0))).toThrow(
      new RangeError("Virtual STM32 cannot accept a snapshot while scoring")
    )
    expect(shell.isUnavailable).toBe(true)
    expect(shell.processedSnapshotCount).toBe(1)
    expect(shell.lastReceipt?.outcome?.source).toBe("weapon-scorer")
    expect(() => shell.ingestSnapshot(snapshot(1))).toThrow(
      new RangeError("Virtual STM32 is unavailable after an authoritative outcome observer failure")
    )

    const asynchronousObserver = createVirtualStm32({
      onAuthoritativeOutcome: () => Promise.resolve(),
      scorer: scorer(),
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    expect(() => asynchronousObserver.ingestSnapshot(snapshot(0))).toThrow(
      new TypeError("Virtual STM32 authoritative outcome observers must complete synchronously")
    )
    expect(asynchronousObserver.isUnavailable).toBe(true)

    const functionThenable = () => undefined
    Object.defineProperty(functionThenable, ["the", "n"].join(""), { value: () => undefined })
    const functionThenableObserver = createVirtualStm32({
      onAuthoritativeOutcome: () => functionThenable,
      scorer: scorer(),
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    expect(() => functionThenableObserver.ingestSnapshot(snapshot(0))).toThrow(
      new TypeError("Virtual STM32 authoritative outcome observers must complete synchronously")
    )
    expect(functionThenableObserver.isUnavailable).toBe(true)
  })

  it("deeply snapshots a bounded plain-data outcome before an observer can receive it", () => {
    const source = { detail: { qualifiedAtUs: 0 }, reasons: ["contact"] }
    let observed: unknown
    const shell = createVirtualStm32({
      onAuthoritativeOutcome: (outcome) => {
        observed = outcome
      },
      scorer: {
        advance: () => ({ outcome: source, state: {} }),
        createState: () => ({}),
        weapon: "foil"
      },
      timingTableRevision: "timing-1",
      weapon: "foil"
    })

    const receipt = shell.ingestSnapshot(snapshot(0))
    source.detail.qualifiedAtUs = 99
    source.reasons.push("late")

    expect(receipt.outcome?.outcome).toEqual({ detail: { qualifiedAtUs: 0 }, reasons: ["contact"] })
    expect(observed).toBe(receipt.outcome)
    expect(Object.isFrozen(receipt)).toBe(true)
    expect(Object.isFrozen(receipt.outcome?.outcome)).toBe(true)
    if (receipt.outcome === null) {
      throw new Error("Expected an authoritative outcome")
    }
    const immutableOutcome = receipt.outcome.outcome
    expect(Object.isFrozen(immutableOutcome.detail)).toBe(true)
    expect(() => {
      immutableOutcome.detail.qualifiedAtUs = 1
    }).toThrow()
    expect(receipt.outcome?.outcome).toEqual({ detail: { qualifiedAtUs: 0 }, reasons: ["contact"] })
  })

  it("rejects non-plain, cyclic, overlarge, and unsupported authoritative outcome data", () => {
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic
    let tooDeep: unknown = {}
    for (let index = 0; index < 8; index += 1) {
      tooDeep = { child: tooDeep }
    }
    const symbolKeyed = { outcome: "value" }
    Object.defineProperty(symbolKeyed, Symbol("hidden"), { value: "hidden" })
    const accessor = {}
    Object.defineProperty(accessor, "outcome", { enumerable: true, get: () => "value" })
    const tooManyKeys = Object.fromEntries(Array.from({ length: 128 }, (_, index) => [`key-${index}`, index]))
    const sparseArray: unknown[] = []
    sparseArray.length = 1
    const accessorArray: unknown[] = []
    Object.defineProperty(accessorArray, "0", { get: () => "value" })
    const extraKeyArray = ["value"]
    Object.defineProperty(extraKeyArray, "extra", { value: "value" })
    const symbolKeyArray = ["value"]
    Object.defineProperty(symbolKeyArray, Symbol("hidden"), { value: "hidden" })

    for (const outcome of [
      Number.POSITIVE_INFINITY,
      "x".repeat(513),
      () => undefined,
      cyclic,
      tooDeep,
      Array.from({ length: 128 }, () => 0),
      tooManyKeys,
      new Date(),
      symbolKeyed,
      accessor,
      sparseArray,
      accessorArray,
      extraKeyArray,
      symbolKeyArray
    ]) {
      const shell = createVirtualStm32({
        scorer: {
          advance: () => ({ outcome, state: {} }),
          createState: () => ({}),
          weapon: "foil"
        },
        timingTableRevision: "timing-1",
        weapon: "foil"
      })
      expect(() => shell.ingestSnapshot(snapshot(0))).toThrow()
    }

    for (const outcome of [false]) {
      const shell = createVirtualStm32({
        scorer: {
          advance: () => ({ outcome, state: {} }),
          createState: () => ({}),
          weapon: "foil"
        },
        timingTableRevision: "timing-1",
        weapon: "foil"
      })
      expect(shell.ingestSnapshot(snapshot(0)).outcome?.outcome).toBe(outcome)
    }

    const frozenArray = Object.freeze(["contact"])
    const frozenArrayShell = createVirtualStm32({
      scorer: {
        advance: () => ({ outcome: frozenArray, state: {} }),
        createState: () => ({}),
        weapon: "foil"
      },
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    const frozenArrayOutcome = frozenArrayShell.ingestSnapshot(snapshot(0)).outcome!.outcome
    expect(frozenArrayOutcome).toEqual(["contact"])
    expect(frozenArrayOutcome).not.toBe(frozenArray)
    expect(Object.isFrozen(frozenArrayOutcome)).toBe(true)

    const prototypePayload = {}
    Object.defineProperty(prototypePayload, "__proto__", {
      configurable: true,
      enumerable: true,
      value: { altered: true },
      writable: true
    })
    const prototypeShell = createVirtualStm32({
      scorer: {
        advance: () => ({ outcome: prototypePayload, state: {} }),
        createState: () => ({}),
        weapon: "foil"
      },
      timingTableRevision: "timing-1",
      weapon: "foil"
    })
    const cloned = prototypeShell.ingestSnapshot(snapshot(0)).outcome!.outcome
    expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype)
    expect(Object.getOwnPropertyDescriptor(cloned, "__proto__")?.value).toEqual({ altered: true })
  })
})
