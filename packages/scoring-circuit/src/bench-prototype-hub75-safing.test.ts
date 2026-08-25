import { describe, expect, it } from "vitest"
import { benchPrototypeHub75Safing, validateBenchPrototypeHub75Safing } from "./bench-prototype-hub75-safing.js"

describe("BP-144 simplified reset-safe HUB75 path", () => {
  it("maps all thirteen committed GPIOs through two exact A-to-B AHCT buffers", () => {
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

  it("uses one shared reset gate instead of duplicated firmware-visible enables", () => {
    const { displayEnableGate, signalDefaults, bufferBypass } = benchPrototypeHub75Safing.supportNetwork
    expect(signalDefaults).toMatchObject({
      reference: "R_HUB75_SIGNAL_DEFAULTS",
      mpn: "RC0603FR-0710KL",
      quantity: 16
    })
    expect(bufferBypass).toMatchObject({
      reference: "C_HUB75_BUFFER_BYPASS",
      mpn: "C0603C104K3RACTU",
      value: "100 nF X7R",
      quantity: 2
    })
    expect(displayEnableGate).toMatchObject({
      net: "DISPLAY_ENABLE_N",
      sink: { reference: "Q_DISPLAY_ENABLE", mpn: "BSS138AKA" },
      pullup: { reference: "R_DISPLAY_ENABLE_PULLUP_AND_GATE", mpn: "RC0603FR-0710KL" },
      gateSeries: { reference: "R_DISPLAY_ENABLE_PULLUP_AND_GATE", mpn: "RC0603FR-0710KL" },
      gatePulldown: { reference: "R_DISPLAY_ENABLE_GATE_PD", mpn: "RC0603FR-07100KL" }
    })
    expect(benchPrototypeHub75Safing.exactConnections.join(" ")).toContain("APP_RESET_N")
    expect(benchPrototypeHub75Safing.exactConnections.join(" ")).not.toContain("EN_RESET")
    expect(benchPrototypeHub75Safing.exactConnections.join(" ")).toContain("no ESP32 GPIO")
  })

  it("keeps all passive defaults and three unused buffer-B inputs explicit", () => {
    expect(benchPrototypeHub75Safing.unusedBufferInputs).toHaveLength(3)
    expect(benchPrototypeHub75Safing.unusedBufferInputs.map((input) => input.input)).toEqual(["A6", "A7", "A8"])
    for (const input of benchPrototypeHub75Safing.unusedBufferInputs) {
      expect(input.pull).toMatchObject({
        reference: "R_HUB75_SIGNAL_DEFAULTS",
        mpn: "RC0603FR-0710KL",
        to: "APP_GND"
      })
      expect(input.outputDisposition).toBe("NC; no connector, test point, or functional net")
    }
    for (const signal of benchPrototypeHub75Safing.signalMap) {
      expect(signal.inputPull).toBe("R_HUB75_SIGNAL_DEFAULTS")
      expect(signal.resetDefault).toBe(
        signal.signal === "HUB75_OE_N" ? "high panel blank request" : "low black-data/address/clock/latch"
      )
    }
    expect(benchPrototypeHub75Safing.supportNetwork.panelOe).toMatchObject({
      reference: "R_HUB75_PANEL_OE_PULLUP",
      mpn: "RC0603FR-0710KL",
      value: "10 kOhm, 1%"
    })
  })

  it("keeps power-off behavior unvalidated and release denied", () => {
    expect(benchPrototypeHub75Safing.powerOffAndBackfeed.status).toBe("unvalidated-deny")
    expect(benchPrototypeHub75Safing.truthTable[2].result).toContain("DENY")
    expect(benchPrototypeHub75Safing.evidence).toMatchObject({
      resetBlankingBenchVerified: false,
      panelPowerOffBackfeedVerified: false,
      fabricationAuthorized: false
    })
    expect(benchPrototypeHub75Safing.releaseState).toBe("deny")
  })

  it("binds the eight active BOM rows and rejects canonical mutations", () => {
    expect(benchPrototypeHub75Safing.partIdentityEvidence).toHaveLength(8)
    expect(benchPrototypeHub75Safing.partIdentityEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: "U_DISPLAY_BUFFER_A",
          mpn: "SN74AHCT245PWR",
          package: "TSSOP-20"
        }),
        expect.objectContaining({
          reference: "R_HUB75_SIGNAL_DEFAULTS",
          mpn: "RC0603FR-0710KL",
          quantity: 16
        }),
        expect.objectContaining({
          reference: "Q_DISPLAY_ENABLE",
          mpn: "BSS138AKA",
          package: "SOT23 (TO-236AB)"
        }),
        expect.objectContaining({
          reference: "R_DISPLAY_ENABLE_GATE_PD",
          mpn: "RC0603FR-07100KL"
        })
      ])
    )
    const candidate = structuredClone(benchPrototypeHub75Safing) as any
    candidate.supportNetwork.displayEnableGate.net = "FIRMWARE_ENABLE"
    expect(() => validateBenchPrototypeHub75Safing(candidate)).toThrow(RangeError)
  })
})
