import { describe, expect, it } from "vitest"
import {
  advanceVirtualFrontEnd,
  advanceVirtualFrontEndCycle,
  createVirtualFrontEndCycleState,
  createVirtualFrontEndState,
  validateVirtualFrontEndSnapshot,
  VIRTUAL_FRONT_END_CONDUCTOR_IDS,
  VIRTUAL_FRONT_END_PHASE_IDS,
  VIRTUAL_FRONT_END_PHASE_PROFILES,
  type VirtualFrontEndFrame,
  type VirtualFrontEndPhase,
  type VirtualFrontEndRelationInput
} from "./virtual-front-end.js"

const activeEpeePhase: VirtualFrontEndPhase = {
  excitation: { owner: "left.A", state: "active" },
  id: "epee-tip-loop",
  perspective: "affected-side",
  safeInactive: false,
  side: "left",
  status: "available"
}

function relation(
  input: Partial<VirtualFrontEndRelationInput> & Pick<VirtualFrontEndRelationInput, "id">
): VirtualFrontEndRelationInput {
  return {
    endpoints: ["left.A", "left.B"],
    faultCode: null,
    provenance: { observedAtUs: 10, sourceId: `source-${input.id}` },
    resistanceMilliOhms: 10_000,
    resistanceUncertaintyMilliOhms: 0,
    state: "closed",
    ...input
  }
}

function frame(input: Partial<VirtualFrontEndFrame> = {}): VirtualFrontEndFrame {
  return {
    atUs: 10,
    phase: activeEpeePhase,
    relations: [relation({ id: "tip-loop" })],
    ...input
  }
}

describe("virtual front-end", () => {
  it("models all seven canonical conductors without choosing a physical pinout", () => {
    expect(VIRTUAL_FRONT_END_CONDUCTOR_IDS).toEqual([
      "left.A",
      "left.B",
      "left.C",
      "right.A",
      "right.B",
      "right.C",
      "piste"
    ])

    const state = advanceVirtualFrontEnd(
      createVirtualFrontEndState(),
      frame({
        relations: [
          relation({ endpoints: ["left.A", "left.B"], id: "left-a-b" }),
          relation({ endpoints: ["left.A", "left.C"], id: "left-a-c" }),
          relation({ endpoints: ["left.B", "left.C"], id: "left-b-c" }),
          relation({ endpoints: ["left.A", "right.A"], id: "left-right-a" }),
          relation({ endpoints: ["right.A", "right.B"], id: "right-a-b" }),
          relation({ endpoints: ["right.A", "right.C"], id: "right-a-c" }),
          relation({ endpoints: ["right.B", "right.C"], id: "right-b-c" }),
          relation({ endpoints: ["left.A", "piste"], id: "left-piste" })
        ]
      })
    )

    expect(state.current?.relations.map((reading) => reading.id)).toEqual([
      "left-a-b",
      "left-a-c",
      "left-piste",
      "left-right-a",
      "left-b-c",
      "right-a-b",
      "right-a-c",
      "right-b-c"
    ])
  })

  it("preserves resistance values, intervals, provenance, and relation states", () => {
    const state = advanceVirtualFrontEnd(
      createVirtualFrontEndState(),
      frame({
        relations: [
          relation({ id: "exact", resistanceMilliOhms: 0, resistanceUncertaintyMilliOhms: 0, state: "open" }),
          relation({
            endpoints: ["left.A", "left.C"],
            faultCode: "open-circuit",
            id: "open-circuit",
            resistanceMilliOhms: null,
            resistanceUncertaintyMilliOhms: null,
            state: "open"
          }),
          relation({
            id: "interval",
            endpoints: ["left.B", "left.C"],
            provenance: { observedAtUs: 8, sourceId: "fixture-interval" },
            resistanceMilliOhms: 100_000,
            resistanceUncertaintyMilliOhms: 5_000
          }),
          relation({
            id: "missing",
            endpoints: ["right.A", "right.B"],
            resistanceMilliOhms: null,
            resistanceUncertaintyMilliOhms: null
          })
        ]
      })
    )

    expect(state.current?.relations.map((reading) => [reading.id, reading.resistance])).toEqual([
      [
        "exact",
        {
          bucket: "exact",
          intervalMilliOhms: { maxMilliOhms: 0, minMilliOhms: 0 },
          resistanceMilliOhms: 0,
          uncertaintyMilliOhms: 0
        }
      ],
      [
        "open-circuit",
        {
          bucket: "not-measured",
          intervalMilliOhms: null,
          resistanceMilliOhms: null,
          uncertaintyMilliOhms: null
        }
      ],
      [
        "interval",
        {
          bucket: "interval",
          intervalMilliOhms: { maxMilliOhms: 105_000, minMilliOhms: 95_000 },
          resistanceMilliOhms: 100_000,
          uncertaintyMilliOhms: 5_000
        }
      ],
      [
        "missing",
        {
          bucket: "not-measured",
          intervalMilliOhms: null,
          resistanceMilliOhms: null,
          uncertaintyMilliOhms: null
        }
      ]
    ])
    expect(state.current?.relations[2]?.provenance).toEqual({ observedAtUs: 8, sourceId: "fixture-interval" })
    expect(state.current?.relations[1]).toMatchObject({ faultCode: "open-circuit", state: "open" })
  })

  it("retains grounded and cross-line observations as distinct evidence", () => {
    const grounded = advanceVirtualFrontEnd(
      createVirtualFrontEndState(),
      frame({
        phase: { ...activeEpeePhase, id: "epee-ground-reference" },
        relations: [
          relation({
            endpoints: ["left.A", "piste"],
            faultCode: "short-to-ground",
            id: "grounded",
            state: "grounded"
          })
        ]
      })
    )
    const crossLine = advanceVirtualFrontEnd(
      createVirtualFrontEndState(),
      frame({
        relations: [
          relation({
            endpoints: ["left.A", "right.A"],
            faultCode: "cross-line",
            id: "cross",
            state: "crossLine"
          })
        ]
      })
    )

    expect(grounded.current?.relations[0]).toMatchObject({ faultCode: "short-to-ground", state: "grounded" })
    expect(crossLine.current?.relations[0]).toMatchObject({ faultCode: "cross-line", state: "crossLine" })
  })

  it("requires unavailable and indeterminate phase evidence to be safe inactive", () => {
    const unavailablePhase: VirtualFrontEndPhase = {
      ...activeEpeePhase,
      excitation: { owner: null, state: "inactive" },
      safeInactive: true,
      status: "unavailable"
    }
    const unavailable = advanceVirtualFrontEnd(
      createVirtualFrontEndState(),
      frame({
        phase: unavailablePhase,
        relations: [
          relation({
            faultCode: "acquisition-gap",
            id: "gap",
            resistanceMilliOhms: null,
            resistanceUncertaintyMilliOhms: null,
            state: "unavailable"
          })
        ]
      })
    )

    expect(unavailable.current).toMatchObject({ trust: "unavailable", phase: { safeInactive: true } })
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({
          phase: { ...activeEpeePhase, status: "indeterminate" },
          relations: [relation({ id: "indeterminate", state: "indeterminate" })]
        })
      )
    ).toThrow(new RangeError("Indeterminate or unavailable virtual front-end phases must be safe inactive"))
  })

  it("keeps contradictory observations instead of collapsing them into booleans", () => {
    const phase: VirtualFrontEndPhase = {
      ...activeEpeePhase,
      excitation: { owner: null, state: "inactive" },
      safeInactive: true,
      status: "indeterminate"
    }
    const state = advanceVirtualFrontEnd(
      createVirtualFrontEndState(),
      frame({
        phase,
        relations: [relation({ id: "closed" }), relation({ id: "open", state: "open" })]
      })
    )

    expect(state.current?.contradictoryRelationIds).toEqual(["closed", "open"])
    expect(state.current?.relations.map((reading) => reading.state)).toEqual(["closed", "open"])
    expect(state.current?.trust).toBe("indeterminate")
  })

  it("emits stable transitions from explicit scoring-clock timestamps", () => {
    const first = advanceVirtualFrontEnd(createVirtualFrontEndState(), frame())
    const second = advanceVirtualFrontEnd(
      first,
      frame({
        atUs: 11,
        relations: [
          relation({ id: "tip-loop", resistanceMilliOhms: 10_000, resistanceUncertaintyMilliOhms: 0, state: "open" }),
          relation({ endpoints: ["right.A", "right.B"], id: "right-loop" })
        ]
      })
    )
    const third = advanceVirtualFrontEnd(second, frame({ atUs: 12, relations: [] }))

    expect(first.current?.transitions.map((transition) => [transition.id, transition.kind])).toEqual([
      ["tip-loop", "added"]
    ])
    expect(second.current?.transitions.map((transition) => [transition.id, transition.kind])).toEqual([
      ["right-loop", "added"],
      ["tip-loop", "changed"]
    ])
    expect(third.current?.transitions.map((transition) => [transition.id, transition.kind])).toEqual([
      ["right-loop", "removed"],
      ["tip-loop", "removed"]
    ])
    expect(JSON.stringify(second)).toBe(
      JSON.stringify(
        advanceVirtualFrontEnd(
          first,
          frame({
            atUs: 11,
            relations:
              second.current?.relations.map((reading) =>
                relation({
                  endpoints: reading.endpoints,
                  faultCode: reading.faultCode,
                  id: reading.id,
                  provenance: reading.provenance,
                  resistanceMilliOhms: reading.resistance.resistanceMilliOhms,
                  resistanceUncertaintyMilliOhms: reading.resistance.uncertaintyMilliOhms,
                  state: reading.state
                })
              ) ?? []
          })
        )
      )
    )

    validateVirtualFrontEndSnapshot(first.current!)
    validateVirtualFrontEndSnapshot(second.current!)
    validateVirtualFrontEndSnapshot(third.current!)

    const added = first.current!
    const changed = second.current!
    const removed = third.current!
    for (const invalidSnapshot of [
      null,
      {},
      { ...added, extra: true },
      { ...added, transitions: null },
      { ...added, relations: Array.from({ length: 33 }, () => added.relations[0]!) },
      { ...added, transitions: [null] },
      { ...added, transitions: [{ ...added.transitions[0]!, extra: true }] },
      { ...added, transitions: [{ ...added.transitions[0]!, atUs: 99 }] },
      { ...added, transitions: [{ ...added.transitions[0]!, kind: "unknown" }] },
      { ...added, transitions: [{ ...added.transitions[0]!, id: "not-tip-loop" }] },
      {
        ...added,
        transitions: [
          {
            ...added.transitions[0]!,
            next: {
              ...added.transitions[0]!.next!,
              provenance: { ...added.transitions[0]!.next!.provenance, observedAtUs: 11 }
            }
          }
        ]
      },
      { ...changed, transitions: [{ ...changed.transitions[1]!, previous: null }] },
      { ...removed, transitions: [{ ...removed.transitions[0]!, next: removed.transitions[0]!.previous }] },
      { ...removed, transitions: [...removed.transitions].reverse() }
    ]) {
      expect(() => validateVirtualFrontEndSnapshot(invalidSnapshot)).toThrow()
    }
  })

  it("contains history and relation collections without mutating retained snapshots", () => {
    let state = createVirtualFrontEndState()
    for (const atUs of [10, 11, 12]) {
      state = advanceVirtualFrontEnd(state, frame({ atUs }), { historyLimit: 2, maxRelationsPerSnapshot: 2 })
    }

    expect(state.snapshots.map((snapshot) => snapshot.atUs)).toEqual([11, 12])
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({ relations: [relation({ id: "a" }), relation({ id: "b" }), relation({ id: "c" })] }),
        {
          maxRelationsPerSnapshot: 2
        }
      )
    ).toThrow(new RangeError("Virtual front-end snapshots may contain at most 2 relations"))
  })

  it("rejects invalid timestamps, units, states, phases, and unsafe input", () => {
    for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => advanceVirtualFrontEnd(createVirtualFrontEndState(), frame({ atUs: value }))).toThrow(
        new RangeError("Virtual front-end timestamps must be a non-negative safe integer")
      )
      expect(() =>
        advanceVirtualFrontEnd(
          createVirtualFrontEndState(),
          frame({ relations: [relation({ id: "bad-resistance", resistanceMilliOhms: value })] })
        )
      ).toThrow(new RangeError("Virtual front-end resistanceMilliOhms must be a non-negative safe integer"))
    }

    const state = advanceVirtualFrontEnd(createVirtualFrontEndState(), frame({ atUs: 10 }))
    expect(() => advanceVirtualFrontEnd(state, frame({ atUs: 9 }))).toThrow(
      new RangeError("Virtual front-end snapshots must use monotonic timestamps")
    )
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({
          relations: [relation({ id: "partial", resistanceMilliOhms: 1, resistanceUncertaintyMilliOhms: null })]
        })
      )
    ).toThrow(new RangeError("Virtual front-end resistance requires a value and uncertainty together"))
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({ relations: [relation({ id: "bad-state", state: "shorted" as never })] })
      )
    ).toThrow(new RangeError("Virtual front-end readings must use a declared relation state"))
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({ relations: [relation({ id: "unordered", endpoints: ["left.B", "left.A"] })] })
      )
    ).toThrow(
      new RangeError("Virtual front-end relation endpoints must be distinct canonical conductors in lexical order")
    )
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({ phase: { ...activeEpeePhase, perspective: "acting-side" } })
      )
    ).toThrow(new RangeError("Virtual front-end phases must use their declared M0-03 perspective"))
    expect(() =>
      advanceVirtualFrontEnd(createVirtualFrontEndState(), frame({ phase: { ...activeEpeePhase, safeInactive: true } }))
    ).toThrow(new RangeError("Safe inactive virtual front-end phases cannot drive excitation"))

    for (const phase of [
      { ...activeEpeePhase, id: "unknown" as never },
      { ...activeEpeePhase, side: "centre" as never },
      { ...activeEpeePhase, status: "unknown" as never },
      { ...activeEpeePhase, safeInactive: "yes" as never },
      { ...activeEpeePhase, excitation: { owner: "unknown", state: "active" } as never },
      { ...activeEpeePhase, excitation: { owner: "left.A", state: "inactive" } as never },
      { ...activeEpeePhase, excitation: { owner: null, state: "unknown" } as never }
    ]) {
      expect(() => advanceVirtualFrontEnd(createVirtualFrontEndState(), frame({ phase }))).toThrow(Error)
    }

    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({
          relations: [
            relation({
              id: "overflow",
              resistanceMilliOhms: Number.MAX_SAFE_INTEGER,
              resistanceUncertaintyMilliOhms: 1
            })
          ]
        })
      )
    ).toThrow(new RangeError("Virtual front-end resistance intervals must remain safe integers"))

    for (const invalidRelation of [
      relation({ faultCode: "unknown" as never, id: "unknown-fault" }),
      relation({ faultCode: null, id: "cross-no-fault", state: "crossLine" }),
      relation({ faultCode: null, id: "range-no-fault", state: "outOfRange" }),
      relation({ faultCode: "cross-line", id: "ground-wrong-fault", state: "grounded" }),
      relation({ faultCode: "cross-line", id: "open-wrong-fault", state: "open" }),
      relation({ faultCode: "open-circuit", id: "closed-open-circuit", state: "closed" })
    ]) {
      expect(() =>
        advanceVirtualFrontEnd(createVirtualFrontEndState(), frame({ relations: [invalidRelation] }))
      ).toThrow(RangeError)
    }

    const unavailablePhase: VirtualFrontEndPhase = {
      ...activeEpeePhase,
      excitation: { owner: null, state: "inactive" },
      safeInactive: true,
      status: "unavailable"
    }
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({
          phase: unavailablePhase,
          relations: [relation({ faultCode: "cross-line", id: "unavailable-cross", state: "unavailable" })]
        })
      )
    ).toThrow(new RangeError("Unavailable readings cannot relabel a line fault"))
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({
          phase: unavailablePhase,
          relations: [relation({ faultCode: "open-circuit", id: "unavailable-open", state: "unavailable" })]
        })
      )
    ).toThrow(new RangeError("open-circuit faults require an open reading"))
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({ relations: [relation({ id: "future", provenance: { observedAtUs: 11, sourceId: "future" } })] })
      )
    ).toThrow(new RangeError("Virtual front-end provenance cannot be observed after its snapshot"))
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({ relations: [relation({ id: "duplicate" }), relation({ id: "duplicate" })] })
      )
    ).toThrow(new RangeError("Virtual front-end snapshots require unique relation IDs"))
    expect(() =>
      advanceVirtualFrontEnd(createVirtualFrontEndState(), frame({ relations: [relation({ id: "a".repeat(121) })] }))
    ).toThrow(new RangeError("Virtual front-end relation IDs must be a non-empty string no longer than 120 characters"))
    expect(
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({ relations: [relation({ id: "untrusted", state: "indeterminate" })] })
      ).current
    ).toMatchObject({ phase: { safeInactive: true, status: "indeterminate" }, trust: "indeterminate" })
    expect(() => advanceVirtualFrontEnd(createVirtualFrontEndState(), frame(), { historyLimit: 0 })).toThrow(
      new RangeError("Virtual front-end collection limits must be greater than zero")
    )
    expect(() => advanceVirtualFrontEnd(createVirtualFrontEndState(), frame(), { maxRelationsPerSnapshot: 0 })).toThrow(
      new RangeError("Virtual front-end collection limits must be greater than zero")
    )
    expect(
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({
          relations: [
            relation({ id: "same-source-a", provenance: { observedAtUs: 10, sourceId: "same-source" } }),
            relation({
              endpoints: ["left.A", "left.C"],
              id: "same-source-b",
              provenance: { observedAtUs: 10, sourceId: "same-source" }
            })
          ]
        })
      ).current?.relations
    ).toHaveLength(2)
  })

  it("treats a changed resistance bucket as a transition without inventing a threshold", () => {
    const first = advanceVirtualFrontEnd(createVirtualFrontEndState(), frame())
    const next = advanceVirtualFrontEnd(
      first,
      frame({
        atUs: 11,
        relations: [
          relation({
            id: "tip-loop",
            resistanceMilliOhms: null,
            resistanceUncertaintyMilliOhms: null
          })
        ]
      })
    )

    expect(next.current?.transitions).toMatchObject([{ id: "tip-loop", kind: "changed" }])
    expect(next.current?.relations[0]?.resistance.bucket).toBe("not-measured")
  })

  it("mirrors left and right phase observations without assigning weapon semantics", () => {
    const mirror = (side: "left" | "right") => {
      const endpoint: readonly ["left.A", "left.B"] | readonly ["right.A", "right.B"] =
        side === "left" ? ["left.A", "left.B"] : ["right.A", "right.B"]
      return advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({
          phase: {
            ...activeEpeePhase,
            excitation: { owner: `${side}.A` as "left.A" | "right.A", state: "active" },
            side
          },
          relations: [relation({ endpoints: endpoint, id: `${side}-tip` })]
        })
      ).current
    }

    expect(mirror("left")).toMatchObject({
      phase: { id: "epee-tip-loop", perspective: "affected-side", side: "left" },
      relations: [{ endpoints: ["left.A", "left.B"], state: "closed" }]
    })
    expect(mirror("right")).toMatchObject({
      phase: { id: "epee-tip-loop", perspective: "affected-side", side: "right" },
      relations: [{ endpoints: ["right.A", "right.B"], state: "closed" }]
    })
  })

  it("derives a weapon from each phase profile and keeps BP-103 labels out of logical relations", () => {
    expect(VIRTUAL_FRONT_END_PHASE_IDS).toHaveLength(10)
    expect(new Set(VIRTUAL_FRONT_END_PHASE_IDS)).toHaveLength(VIRTUAL_FRONT_END_PHASE_IDS.length)
    expect(VIRTUAL_FRONT_END_PHASE_IDS).toEqual(VIRTUAL_FRONT_END_PHASE_PROFILES.map((profile) => profile.id))
    expect(VIRTUAL_FRONT_END_PHASE_PROFILES.map((profile) => [profile.id, profile.weapon])).toEqual([
      ["foil-circuit-integrity", "foil"],
      ["foil-target-context", "foil"],
      ["foil-insulation-diagnostic", "foil"],
      ["epee-tip-loop", "epee"],
      ["epee-ground-reference", "epee"],
      ["epee-line-integrity", "epee"],
      ["sabre-target-contact", "sabre"],
      ["sabre-own-equipment", "sabre"],
      ["sabre-blade-contact", "sabre"],
      ["sabre-bc-control", "sabre"]
    ])
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({ relations: [relation({ endpoints: ["LEFT_WEAPON_A" as never, "LEFT_WEAPON_B" as never], id: "net" })] })
      )
    ).toThrow(RangeError)
  })

  it("requires the M0-03 safe, select, settle, observe, release cycle", () => {
    const command = (stage: "safe-inactive" | "select-source" | "settle" | "observe" | "release", atUs: number) => ({
      atUs,
      cycleId: "cycle-1",
      phaseId: "epee-tip-loop" as const,
      relations:
        stage === "observe" ? [relation({ provenance: { observedAtUs: atUs, sourceId: "fixture" }, id: "tip" })] : null,
      side: "left" as const,
      source: stage === "safe-inactive" || stage === "release" ? null : ("left.A" as const),
      stage
    })
    let state = createVirtualFrontEndCycleState()
    for (const [stage, atUs, status] of [
      ["safe-inactive", 1, "safe-inactive"],
      ["select-source", 2, "selected"],
      ["settle", 3, "settled"],
      ["observe", 4, "observed"],
      ["release", 5, "released"]
    ] as const) {
      const advanced = advanceVirtualFrontEndCycle(state, command(stage, atUs))
      expect(advanced.receipt).toMatchObject({
        safeInactive: stage === "safe-inactive" || stage === "release",
        status,
        weapon: "epee"
      })
      state = advanced.state
    }
  })

  it("fails closed for incomplete, stale, unsafe, cross-line, overrun, contradictory, and malformed cycle evidence", () => {
    const cycle = (
      stage: "safe-inactive" | "select-source" | "settle" | "observe",
      atUs: number,
      relations: readonly VirtualFrontEndRelationInput[] | null = null
    ) => ({
      atUs,
      cycleId: "adversarial",
      phaseId: "epee-tip-loop" as const,
      relations,
      side: "left" as const,
      source: stage === "safe-inactive" ? null : ("left.A" as const),
      stage
    })
    expect(
      advanceVirtualFrontEndCycle(createVirtualFrontEndCycleState(), cycle("observe", 1, [])).receipt
    ).toMatchObject({ diagnostic: "cycle-incomplete", safeInactive: true, status: "fault" })
    let state = createVirtualFrontEndCycleState()
    for (const [stage, atUs] of [
      ["safe-inactive", 1],
      ["select-source", 2],
      ["settle", 3]
    ] as const) {
      state = advanceVirtualFrontEndCycle(state, cycle(stage, atUs)).state
    }
    const beforeObserve = () => {
      let prepared = createVirtualFrontEndCycleState()
      for (const [stage, atUs] of [
        ["safe-inactive", 10],
        ["select-source", 11],
        ["settle", 12]
      ] as const) {
        prepared = advanceVirtualFrontEndCycle(prepared, cycle(stage, atUs)).state
      }
      return prepared
    }
    const crossLine = advanceVirtualFrontEndCycle(
      state,
      cycle("observe", 4, [
        relation({
          endpoints: ["left.A", "right.A"],
          id: "cross",
          provenance: { observedAtUs: 4, sourceId: "fixture" }
        })
      ])
    )
    expect(crossLine.receipt).toMatchObject({ diagnostic: "cross-line", safeInactive: true, status: "fault" })
    expect(advanceVirtualFrontEndCycle(crossLine.state, cycle("safe-inactive", 4)).receipt).toMatchObject({
      diagnostic: "stale-sample",
      safeInactive: true,
      status: "fault"
    })
    expect(
      advanceVirtualFrontEndCycle(
        beforeObserve(),
        cycle("observe", 13, [
          relation({
            faultCode: "out-of-range-resistance",
            id: "range",
            provenance: { observedAtUs: 13, sourceId: "fixture" },
            state: "outOfRange"
          })
        ])
      ).receipt
    ).toMatchObject({ diagnostic: "out-of-range-resistance", safeInactive: true, status: "fault" })
    expect(
      advanceVirtualFrontEndCycle(
        beforeObserve(),
        cycle("observe", 13, [
          relation({
            faultCode: "sample-overrun",
            id: "overrun",
            provenance: { observedAtUs: 13, sourceId: "fixture" },
            resistanceMilliOhms: null,
            resistanceUncertaintyMilliOhms: null,
            state: "unavailable"
          })
        ])
      ).receipt
    ).toMatchObject({ diagnostic: "sample-overrun", safeInactive: true, status: "fault" })
    expect(
      advanceVirtualFrontEndCycle(
        beforeObserve(),
        cycle("observe", 13, [
          relation({ id: "closed", provenance: { observedAtUs: 13, sourceId: "fixture-a" } }),
          relation({ id: "open", provenance: { observedAtUs: 13, sourceId: "fixture-b" }, state: "open" })
        ])
      ).receipt
    ).toMatchObject({ diagnostic: "uncertain-evidence", safeInactive: true, status: "fault" })
    expect(() =>
      advanceVirtualFrontEndCycle(createVirtualFrontEndCycleState(), { ...cycle("safe-inactive", 1), extra: true })
    ).toThrow(TypeError)
    expect(() => advanceVirtualFrontEndCycle(createVirtualFrontEndCycleState(), cycle("observe", 1, null))).toThrow(
      TypeError
    )
  })
  it("preflights own data and rejects getters, sparse arrays, subclasses, and aliases", () => {
    const base = {
      atUs: 1,
      cycleId: "preflight",
      phaseId: "epee-tip-loop" as const,
      relations: null,
      side: "left" as const,
      source: null,
      stage: "safe-inactive" as const
    }
    let getterRead = false
    const getterCommand = { ...base }
    Object.defineProperty(getterCommand, "atUs", {
      enumerable: true,
      get: () => {
        getterRead = true
        return 1
      }
    })
    expect(() => advanceVirtualFrontEndCycle(createVirtualFrontEndCycleState(), getterCommand)).toThrow(TypeError)
    expect(getterRead).toBe(false)
    expect(() => advanceVirtualFrontEndCycle(createVirtualFrontEndCycleState(), Object.create(base))).toThrow(TypeError)

    const active = advanceVirtualFrontEndCycle(createVirtualFrontEndCycleState(), base).state
    const selected = advanceVirtualFrontEndCycle(active, {
      ...base,
      atUs: 2,
      source: "left.A",
      stage: "select-source"
    }).state
    const settled = advanceVirtualFrontEndCycle(selected, { ...base, atUs: 3, source: "left.A", stage: "settle" }).state
    const reading = relation({ id: "tip", provenance: { observedAtUs: 4, sourceId: "fixture" } })
    const sparse = [] as VirtualFrontEndRelationInput[]
    sparse.length = 1
    expect(() =>
      advanceVirtualFrontEndCycle(settled, { ...base, atUs: 4, relations: sparse, source: "left.A", stage: "observe" })
    ).toThrow(TypeError)
    class RelationArray extends Array<VirtualFrontEndRelationInput> {}
    expect(() =>
      advanceVirtualFrontEndCycle(settled, {
        ...base,
        atUs: 4,
        relations: new RelationArray(reading),
        source: "left.A",
        stage: "observe"
      })
    ).toThrow(TypeError)
    expect(() =>
      advanceVirtualFrontEndCycle(settled, {
        ...base,
        atUs: 4,
        relations: [reading, reading],
        source: "left.A",
        stage: "observe"
      })
    ).toThrow(TypeError)
  })

  it("reports unauthorized excitation and deeply freezes returned cycle values", () => {
    const command = (
      atUs: number,
      stage: "safe-inactive" | "select-source" | "settle" | "observe",
      source: "left.A" | "right.A" | null
    ) => ({
      atUs,
      cycleId: "immutable",
      phaseId: "epee-tip-loop" as const,
      relations:
        stage === "observe" ? [relation({ id: "tip", provenance: { observedAtUs: atUs, sourceId: "fixture" } })] : null,
      side: "left" as const,
      source,
      stage
    })
    const safe = advanceVirtualFrontEndCycle(createVirtualFrontEndCycleState(), command(1, "safe-inactive", null))
    expect(advanceVirtualFrontEndCycle(safe.state, command(2, "select-source", "right.A")).receipt).toMatchObject({
      diagnostic: "unauthorized-excitation",
      safeInactive: true,
      status: "fault"
    })
    let state = safe.state
    for (const [atUs, stage, source] of [
      [2, "select-source", "left.A"],
      [3, "settle", "left.A"],
      [4, "observe", "left.A"]
    ] as const)
      state = advanceVirtualFrontEndCycle(state, command(atUs, stage, source)).state
    expect(Object.isFrozen(state)).toBe(true)
    expect(Object.isFrozen(state.frontEnd)).toBe(true)
    expect(Object.isFrozen(state.frontEnd.snapshots)).toBe(true)
    expect(Object.isFrozen(state.frontEnd.current)).toBe(true)
    expect(Object.isFrozen(state.frontEnd.current?.relations)).toBe(true)
    expect(Object.isFrozen(state.frontEnd.current?.relations[0]?.provenance)).toBe(true)
  })
})
