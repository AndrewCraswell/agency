import { describe, expect, it } from "vitest"
import { benchPrototypeHub75Safing, validateBenchPrototypeHub75Safing } from "./bench-prototype-hub75-safing.js"

describe("BP-144 reset-safe HUB75 path", () => {
  it("maps all thirteen committed GPIOs through two exact A-to-B AHCT buffers", () => {
    expect(validateBenchPrototypeHub75Safing(benchPrototypeHub75Safing)).toBe(true)
    expect(benchPrototypeHub75Safing.signalMap).toHaveLength(13)
    expect(
      benchPrototypeHub75Safing.signalMap.map((entry) => [entry.signal, entry.gpio, entry.panelPinNumber])
    ).toEqual([
      ["HUB75_R1", 13, 1],
      ["HUB75_G1", 14, 2],
      ["HUB75_B1", 21, 3],
      ["HUB75_R2", 16, 5],
      ["HUB75_G2", 38, 6],
      ["HUB75_B2", 39, 7],
      ["HUB75_A", 40, 9],
      ["HUB75_B", 41, 10],
      ["HUB75_C", 42, 11],
      ["HUB75_D", 45, 12],
      ["HUB75_CLK", 46, 13],
      ["HUB75_LAT", 48, 14],
      ["HUB75_OE_N", 1, 15]
    ])
    expect(benchPrototypeHub75Safing.buffers.map((buffer) => buffer.mpn)).toEqual(["SN74AHCT245PWR", "SN74AHCT245PWR"])
    expect(benchPrototypeHub75Safing.signalMap).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signal: "HUB75_R1",
          input: "A1",
          bufferInputPin: 2,
          output: "B1",
          bufferOutputPin: 18
        }),
        expect.objectContaining({
          signal: "HUB75_B",
          input: "A8",
          bufferInputPin: 9,
          output: "B8",
          bufferOutputPin: 11
        }),
        expect.objectContaining({
          signal: "HUB75_OE_N",
          input: "A5",
          bufferInputPin: 6,
          output: "B5",
          bufferOutputPin: 14
        })
      ])
    )
  })

  it("uses reset-gated enables and passive blanking defaults rather than a firmware enable", () => {
    expect(benchPrototypeHub75Safing.supportNetwork.bufferBypass).toEqual([
      expect.objectContaining({
        reference: "C_HUB75_BUF_A_BYPASS",
        mpn: "C0603C104K3RACTU",
        value: "100 nF X7R"
      }),
      expect.objectContaining({
        reference: "C_HUB75_BUF_B_BYPASS",
        mpn: "C0603C104K3RACTU",
        value: "100 nF X7R"
      })
    ])
    expect(benchPrototypeHub75Safing.supportNetwork.enableGates).toHaveLength(2)
    for (const gate of benchPrototypeHub75Safing.supportNetwork.enableGates) {
      expect(gate).toMatchObject({
        enablePullup: { mpn: "RC0603FR-0710KL", value: "10 kOhm, 1%" },
        gatePulldown: { mpn: "RC0603FR-07100KL", value: "100 kOhm, 1%" },
        sink: { mpn: "BSS138AKA" }
      })
    }
    expect(benchPrototypeHub75Safing.truthTable[0]).toMatchObject({
      buffers: "both disabled high impedance",
      panelOe: "high by V5 pullup"
    })
    expect(benchPrototypeHub75Safing.signalMap).toHaveLength(13)
    for (const signal of benchPrototypeHub75Safing.signalMap) {
      expect(signal.inputPull).toBe(signal.signal === "HUB75_OE_N" ? "R_HUB75_OE_PULLUP" : `R_${signal.signal}_PD`)
      expect(signal.resetDefault).toBe(
        signal.signal === "HUB75_OE_N" ? "high panel blank request" : "low black-data/address/clock/latch"
      )
    }
    expect(benchPrototypeHub75Safing.supportNetwork.panelOe).toMatchObject({
      reference: "R_HUB75_PANEL_OE_PULLUP",
      mpn: "RC0603FR-0710KL",
      value: "10 kOhm, 1%"
    })
    expect(benchPrototypeHub75Safing.unusedBufferInputs).toEqual([
      expect.objectContaining({
        input: "A6",
        inputPin: 7,
        output: "B6",
        outputPin: 13,
        pull: { mpn: "RC0603FR-0710KL", value: "10 kOhm, 1%", to: "APP_GND", reference: "R_HUB75_UNUSED_B_A6_PD" }
      }),
      expect.objectContaining({
        input: "A7",
        inputPin: 8,
        output: "B7",
        outputPin: 12,
        pull: { mpn: "RC0603FR-0710KL", value: "10 kOhm, 1%", to: "APP_GND", reference: "R_HUB75_UNUSED_B_A7_PD" }
      }),
      expect.objectContaining({
        input: "A8",
        inputPin: 9,
        output: "B8",
        outputPin: 11,
        pull: { mpn: "RC0603FR-0710KL", value: "10 kOhm, 1%", to: "APP_GND", reference: "R_HUB75_UNUSED_B_A8_PD" }
      })
    ])
  })

  it("keeps power-off behavior unvalidated and release denied", () => {
    expect(benchPrototypeHub75Safing.powerOffAndBackfeed.status).toBe("unvalidated-deny")
    expect(benchPrototypeHub75Safing.truthTable[2].result).toContain("DENY")
    expect(benchPrototypeHub75Safing.evidence).toMatchObject({
      resetBlankingBenchVerified: false,
      panelPowerOffBackfeedVerified: false,
      fabricationAuthorized: false
    })
  })

  it("uses a complete carrier-owned live identity for every support reference", () => {
    expect(benchPrototypeHub75Safing.partIdentityEvidence).toHaveLength(29)
    expect(benchPrototypeHub75Safing.partIdentityEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: "U_DISPLAY_BUFFER_A",
          mpn: "SN74AHCT245PWR",
          package: "TSSOP-20",
          manufacturer: "Texas Instruments"
        }),
        expect.objectContaining({
          reference: "C_HUB75_BUF_A_BYPASS",
          mpn: "C0603C104K3RACTU",
          value: "100 nF X7R",
          package: "0603",
          manufacturer: "KEMET"
        }),
        expect.objectContaining({
          reference: "R_HUB75_UNUSED_B_A6_PD",
          mpn: "RC0603FR-0710KL",
          value: "10 kOhm, 1%",
          package: "0603",
          manufacturer: "Yageo"
        }),
        expect.objectContaining({
          reference: "Q_DISPLAY_BUFFER_A_ENABLE",
          mpn: "BSS138AKA",
          package: "SOT-23",
          manufacturer: "Nexperia"
        })
      ])
    )
    for (const part of benchPrototypeHub75Safing.partIdentityEvidence) {
      expect(part.sourceUrl).toMatch(/^https:\/\//)
      expect(part.source).not.toContain("BP-123")
    }
  })

  it("rejects signal swaps, missing gates, release escalation, aliases, and accessors", () => {
    for (const mutate of [
      (candidate: any) => (candidate.signalMap[0].gpio = 14),
      (candidate: any) => candidate.supportNetwork.enableGates.pop(),
      (candidate: any) => (candidate.unusedBufferInputs[0].outputDisposition = "connected"),
      (candidate: any) => (candidate.buffers[0].direction = "firmware controlled"),
      (candidate: any) => (candidate.partIdentityEvidence[0].mpn = "SN74AHCT245PWR_FORGED"),
      (candidate: any) => candidate.partIdentityEvidence.pop(),
      (candidate: any) => (candidate.evidence.fabricationAuthorized = true)
    ]) {
      const candidate = structuredClone(benchPrototypeHub75Safing)
      mutate(candidate)
      expect(() => validateBenchPrototypeHub75Safing(candidate)).toThrow(RangeError)
    }
    const alias = structuredClone(benchPrototypeHub75Safing) as any
    alias.evidence = alias.powerOffAndBackfeed
    expect(() => validateBenchPrototypeHub75Safing(alias)).toThrow(RangeError)
    const accessor = structuredClone(benchPrototypeHub75Safing) as any
    let read = false
    Object.defineProperty(accessor, "workUnit", {
      enumerable: true,
      get: () => {
        read = true
        return "BP-144"
      }
    })
    expect(() => validateBenchPrototypeHub75Safing(accessor)).toThrow(RangeError)
    expect(read).toBe(false)
  })
})
