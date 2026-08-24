import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  benchPrototypeProcessorSupport,
  validateBenchPrototypeProcessorSupport
} from "./bench-prototype-processor-support.js"

describe("BP-125 processor support", () => {
  it("retains the exact processors, their mandatory bypass coverage, and a denied release", () => {
    expect(validateBenchPrototypeProcessorSupport(benchPrototypeProcessorSupport)).toBe(true)
    expect(benchPrototypeProcessorSupport.bypassAndBulk.stm32Digital.references).toEqual([
      "C_STM_VDD16",
      "C_STM_VDD32",
      "C_STM_VDD48",
      "C_STM_VDD64"
    ])
    expect(benchPrototypeProcessorSupport.bypassAndBulk.stm32Analog.vref).toMatchObject({
      values: ["100 nF X7R", "1 uF X7R"]
    })
    expect(benchPrototypeProcessorSupport.bypassAndBulk.esp32.values).toEqual(["100 nF X7R", "22 uF minimum ceramic"])
    expect(benchPrototypeProcessorSupport.bypassAndBulk.stm32Digital.capacitorMpn).toBe("GCM188R71H104KA57D")
    expect(benchPrototypeProcessorSupport.supportSelectionEvidence.stm32DigitalBypass).toMatchObject({
      mpn: "GCM188R71H104KA57D",
      manufacturer: "Murata",
      references: ["C_STM_VDD16", "C_STM_VDD32", "C_STM_VDD48", "C_STM_VDD64"],
      value: "100 nF",
      tolerance: "±10%",
      dielectric: "X7R",
      voltageRating: "50 VDC",
      package: "0603 (1608M)",
      temperatureScope: "-55 to 125 C",
      archiveSha256: "5A29828795FE4B9B8282C7C7FC77E7859FD5E25A64E208257ED25BE08EF2402A",
      requestContextPath: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-request.txt",
      requestContextSha256: "B46660B122DCEF2DF94D30DCD2C4C1E4602D36350006B14E94B4F97F31004D58"
    })
    expect(benchPrototypeProcessorSupport.authority).toMatchObject({
      schematicSignoff: "deny",
      fabricationAuthorized: false
    })
  })

  it("hash-verifies the Yageo primary source for the selected STM32 BOOT0 pulldown", () => {
    const source = benchPrototypeProcessorSupport.supportSelectionEvidence.stm32Boot0Pulldown
    const esp32Source = benchPrototypeProcessorSupport.supportSelectionEvidence.esp32BootPullup
    const esp32EnSource = benchPrototypeProcessorSupport.supportSelectionEvidence.esp32EnPullup
    const packageRoot = new URL("../", import.meta.url)
    const bytes = readFileSync(new URL(source.archivePath, packageRoot))

    expect(source.reference).toBe("R_STM_BOOT0")
    expect(source.mpn).toBe("RC0603FR-0710KL")
    expect(createHash("sha256").update(bytes).digest("hex").toUpperCase()).toBe(source.archiveSha256)
    const raw = bytes.toString("latin1")
    expect(raw).toContain("RC0603FR-0710KL")
    expect(raw).toContain("0603")
    expect(esp32Source).toMatchObject({
      reference: "R_ESP_BOOT_PULLUP",
      mpn: "RC0603FR-0710KL",
      archivePath: source.archivePath,
      archiveSha256: source.archiveSha256
    })
    expect(
      createHash("sha256")
        .update(readFileSync(new URL(esp32Source.archivePath, packageRoot)))
        .digest("hex")
        .toUpperCase()
    ).toBe(esp32Source.archiveSha256)
    expect(esp32EnSource).toMatchObject({
      reference: "R_ESP_EN_PULLUP",
      mpn: "RC0603FR-0710KL",
      archivePath: source.archivePath,
      archiveSha256: source.archiveSha256
    })
    expect(
      createHash("sha256")
        .update(readFileSync(new URL(esp32EnSource.archivePath, packageRoot)))
        .digest("hex")
        .toUpperCase()
    ).toBe(esp32EnSource.archiveSha256)
  })

  it("hash-verifies every retained Murata capacitor byte and preserves ordered request identity", () => {
    const source = benchPrototypeProcessorSupport.supportSelectionEvidence.stm32DigitalBypass
    const packageRoot = new URL("../", import.meta.url)
    const hash = (path: string) =>
      createHash("sha256")
        .update(readFileSync(new URL(path, packageRoot)))
        .digest("hex")
        .toUpperCase()

    expect(source.characteristicRecords).toEqual([
      expect.objectContaining({
        temperature: "-40 C",
        path: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tcneg40.json",
        sha256: "81EE2E884FB23E3590B73BB43784A697E4FF7620E77C4F2C1DB44ACB543B54E0"
      }),
      expect.objectContaining({
        temperature: "25 C",
        path: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc25.json",
        sha256: "D4B4A03EEDA87CFD812511927DAE323120A2B5F2DFFF1828F8B9DEF090829B7A"
      }),
      expect.objectContaining({
        temperature: "85 C",
        path: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc85.json",
        sha256: "0E624A2E28283EB1DABCA2E25B4C7B30F50243348D6E6D47A385AC3E43E51101"
      }),
      expect.objectContaining({
        temperature: "125 C",
        path: "docs/evidence/bp-125/murata-gcm188r71h104ka57d-dcbias-tc125.json",
        sha256: "F7A096FD71D88535F4AD23B10BCD456498C8468C43E203AEDA0547D3AD0101FD"
      })
    ])
    expect(hash(source.archivePath)).toBe(source.archiveSha256)
    expect(hash(source.requestContextPath)).toBe(source.requestContextSha256)
    for (const record of source.characteristicRecords) {
      expect(hash(record.path)).toBe(record.sha256)
      expect(readFileSync(new URL(record.path, packageRoot), "utf8")).toContain('"partnumber":"GCM188R71H104KA57"')
      expect(record.requestIdentity).toContain("c_dcbias_capacitance")
      expect(record.requestIdentity).toContain(`temperature=${record.temperature.replace(" C", "")}`)
    }
    const requestContext = readFileSync(new URL(source.requestContextPath, packageRoot), "utf8")
    expect(requestContext).toContain("https://ds.murata.com/simserve/characteristics")
    expect(requestContext).toContain("no numeric DC-bias claim")
  })

  it("keeps unselected STM32 clocks DNP, module timing internal, and reset/strap loads safe", () => {
    expect(benchPrototypeProcessorSupport.oscillators.stm32Hse).toMatchObject({
      population: "DNP",
      exactOscillatorMpn: "TBD"
    })
    expect(benchPrototypeProcessorSupport.oscillators.stm32Lse).toMatchObject({
      population: "DNP",
      exactOscillatorMpn: "TBD"
    })
    expect(benchPrototypeProcessorSupport.oscillators.esp32.population).toBe("module-integrated")
    expect(benchPrototypeProcessorSupport.bootAndReset.stm32.boot0.value).toBe("10 kOhm pulldown")
    expect(benchPrototypeProcessorSupport.bootAndReset.esp32.en).toMatchObject({
      mpn: "RC0603FR-0710KL",
      value: "10 kOhm pullup",
      capacitorValue: "1 uF"
    })
    expect(benchPrototypeProcessorSupport.bootAndReset.esp32.straps).toEqual(
      expect.arrayContaining([
        { gpio: 3, disposition: "unconnected and quiet" },
        { gpio: 45, disposition: "weak external pulldown and high-impedance AHCT input during reset" }
      ])
    )
    expect(benchPrototypeProcessorSupport.bootAndReset.esp32.irReceiver).toMatchObject({
      modulePad: 28,
      gpio: 35,
      signal: "IR_RX",
      peripheral: "RMT_RX",
      receiverHardware: "BP-146 not selected"
    })
    expect(benchPrototypeProcessorSupport.bootAndReset.esp32.unusedPads).toEqual(
      expect.arrayContaining(["GPIO33 and GPIO34 not exposed by N16R2", "GPIO36 and GPIO37 reserved NC for DNP audio"])
    )
  })

  it("fails closed for substitutions, omissions, and release escalation", () => {
    for (const mutate of [
      (candidate: any) => (candidate.processors.stm32.part = "STM32G474RBT3TR"),
      (candidate: any) => candidate.bypassAndBulk.stm32Digital.references.pop(),
      (candidate: any) => (candidate.bypassAndBulk.stm32Analog.vref.values[0] = "10 nF X7R"),
      (candidate: any) => (candidate.bypassAndBulk.esp32.values[1] = "10 uF minimum ceramic"),
      (candidate: any) => (candidate.bypassAndBulk.stm32Digital.capacitorMpn = "TBD"),
      (candidate: any) => (candidate.oscillators.stm32Hse.population = "selected"),
      (candidate: any) => (candidate.authority.fabricationAuthorized = true)
    ]) {
      const candidate = structuredClone(benchPrototypeProcessorSupport)
      mutate(candidate)
      expect(() => validateBenchPrototypeProcessorSupport(candidate)).toThrow(RangeError)
    }
  })

  it("is deeply frozen and rejects aliases and accessors before reading them", () => {
    expect(Object.isFrozen(benchPrototypeProcessorSupport)).toBe(true)
    expect(Object.isFrozen(benchPrototypeProcessorSupport.bypassAndBulk.stm32Digital.references)).toBe(true)
    const alias = structuredClone(benchPrototypeProcessorSupport) as any
    alias.bootAndReset.esp32 = alias.bootAndReset.stm32
    expect(() => validateBenchPrototypeProcessorSupport(alias)).toThrow(RangeError)
    const accessor = structuredClone(benchPrototypeProcessorSupport) as any
    let read = false
    Object.defineProperty(accessor, "workUnit", {
      enumerable: true,
      get: () => {
        read = true
        return "BP-125"
      }
    })
    expect(() => validateBenchPrototypeProcessorSupport(accessor)).toThrow(RangeError)
    expect(read).toBe(false)
  })
})
