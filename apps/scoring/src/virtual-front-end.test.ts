import { describe, expect, it } from "vitest"
import {
  advanceVirtualFrontEnd,
  createVirtualFrontEndState,
  VIRTUAL_FRONT_END_CONDUCTOR_IDS,
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
    expect(() =>
      advanceVirtualFrontEnd(
        createVirtualFrontEndState(),
        frame({ relations: [relation({ id: "untrusted", state: "indeterminate" })] })
      )
    ).toThrow(
      new RangeError("Virtual front-end phase status must preserve unavailable or indeterminate relation evidence")
    )
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
})
