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
      values: ["100 nF X7R", "1 uF minimum effective X7R"],
      capacitorMpns: ["GCM188R71H104KA57D", "GCM21BR71E225KA73L"]
    })
    expect(benchPrototypeProcessorSupport.bypassAndBulk.esp32).toMatchObject({
      values: ["100 nF X7R", "22 uF minimum effective ceramic"],
      capacitorMpns: ["GCM188R71H104KA57D", "GCM32EC71A476KE02L"]
    })
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

  it("binds the eight remaining capacitor roles to conservative automotive selections and retained DC-bias bytes", () => {
    const support = benchPrototypeProcessorSupport
    const packageRoot = new URL("../", import.meta.url)
    const hash = (path: string) =>
      createHash("sha256")
        .update(readFileSync(new URL(path, packageRoot)))
        .digest("hex")
        .toUpperCase()

    expect(support.supportSelectionEvidence.processorRequirements).toMatchObject({
      stm32: {
        primarySourceMapping: "verified-by-retained-manufacturer-primary-bytes",
        retainedManufacturerPrimaryBytes: {
          archivePath: "docs/evidence/bp-125/st-stm32g474re-ds12288-rev6-datasheet.pdf",
          archiveSha256: "B018E20DBE34B63A43E49365518B186EF0E0E8E899DEEABC1C9F53A3A10C1ADD"
        }
      },
      esp32: {
        primarySourceMapping: "verified-by-retained-manufacturer-primary-bytes",
        retainedManufacturerPrimaryBytes: {
          archivePath: "docs/evidence/bp-032/espressif-esp32-s3-wroom-1u-datasheet-v1.8-official.pdf",
          archiveSha256: "27D71971DA07C280C6068D08C74720D1A25B8F20CF8494DC1765BDD28D40D435"
        }
      }
    })
    expect(
      hash(support.supportSelectionEvidence.processorRequirements.esp32.retainedManufacturerPrimaryBytes.archivePath)
    ).toBe(support.supportSelectionEvidence.processorRequirements.esp32.retainedManufacturerPrimaryBytes.archiveSha256)
    expect(
      hash(support.supportSelectionEvidence.processorRequirements.stm32.retainedManufacturerPrimaryBytes.archivePath)
    ).toBe(support.supportSelectionEvidence.processorRequirements.stm32.retainedManufacturerPrimaryBytes.archiveSha256)
    expect(support.supportSelectionEvidence.capacitorSelections).toEqual([
      expect.objectContaining({
        references: ["C_STM_3V3_BULK"],
        mpn: "GCM32ER71E106KA57L",
        nominal: "10 uF ±10%",
        effectiveRequirement: "4.7 uF minimum at 3.3 V",
        dielectric: "X7R",
        voltageRating: "25 VDC",
        package: "1210 (3225M)"
      }),
      expect.objectContaining({ references: ["C_STM_VDDA_HF"], mpn: "GCM188R71H103KA37D" }),
      expect.objectContaining({
        references: ["C_STM_VDDA_BULK", "C_STM_VREF_BULK"],
        mpn: "GCM21BR71E225KA73L",
        nominal: "2.2 uF ±10%",
        effectiveRequirement: "1 uF minimum at 3.3 V VDDA and 2.5 V VREF+",
        dielectric: "X7R",
        voltageRating: "25 VDC"
      }),
      expect.objectContaining({
        references: ["C_STM_VREF_HF", "C_STM_VBAT", "C_ESP_3V3_HF"],
        mpn: "GCM188R71H104KA57D"
      }),
      expect.objectContaining({
        references: ["C_ESP_3V3_BULK"],
        mpn: "GCM32EC71A476KE02L",
        nominal: "47 uF ±10%",
        effectiveRequirement: "22 uF minimum at 3.3 V",
        dielectric: "X7S",
        voltageRating: "10 VDC",
        package: "1210 (3225M)"
      })
    ])
    for (const selection of support.supportSelectionEvidence.capacitorSelections) {
      expect(selection.reliability).toBe("GCM automotive powertrain/safety, AEC-Q200")
      expect(selection.dcBias.sampleBiasV).toBeGreaterThanOrEqual(3.3)
      expect(selection.dcBias.sampleCapacitanceUf).toBeGreaterThan(
        selection.references.some((reference) => reference === "C_ESP_3V3_BULK") ? 22 : 0.009
      )
      expect(hash(selection.dcBias.archivePath)).toBe(selection.dcBias.archiveSha256)
      expect(readFileSync(new URL(selection.dcBias.archivePath, packageRoot), "utf8")).toContain("c_dcbias_capacitance")
    }
    const analogBulk = support.supportSelectionEvidence.capacitorSelections[2]
    expect(analogBulk).toMatchObject({
      mpn: "GCM21BR71E225KA73L",
      primarySourceMapping: "verified-by-retained-manufacturer-primary-bytes",
      archivePath: "docs/evidence/bp-125/murata-gcm21br71e225ka73-01.pdf",
      archiveSourceUrl: "https://search.murata.co.jp/Ceramy/image/img/A01X/G101/ENG/GCM21BR71E225KA73-01.pdf",
      archiveSha256: "26C42A798F304AA1D91453CC08646D91214125E6C7A1D93C9BD5B0D535AECF19"
    })
    expect(analogBulk.packageBodyGeometry).toEqual({
      lengthMm: { nominal: 2, tolerance: "±0.15" },
      widthMm: { nominal: 1.25, tolerance: "±0.15" },
      thicknessMm: { nominal: 1.25, tolerance: "±0.15" },
      terminalWidthMm: { minimum: 0.2, maximum: 0.7 },
      terminalGapMinimumMm: 0.7,
      source: "Murata GCM21BR71E225KA73-01 retained reference sheet",
      claimBoundary:
        "Package-body and terminal dimensions only; no PCB land pattern, pad, mask, paste, courtyard, or manufacturer CAD is claimed."
    })
    expect(hash(analogBulk.archivePath)).toBe(analogBulk.archiveSha256)

    const expectedDcBias = new Map([
      ["GCM32ER71E106KA57L", { sourcePartNumber: "GCM32ER71E106KA57", temperatureC: 25, acVrms: 1 }],
      ["GCM188R71H103KA37D", { sourcePartNumber: "GCM188R71H103KA37", temperatureC: 125, acVrms: 1 }],
      ["GCM21BR71E225KA73L", { sourcePartNumber: "GCM21BR71E225KA73", temperatureC: 25, acVrms: 1 }],
      ["GCM188R71H104KA57D", { sourcePartNumber: "GCM188R71H104KA57", temperatureC: 125, acVrms: 1 }],
      ["GCM32EC71A476KE02L", { sourcePartNumber: "GCM32EC71A476KE02", temperatureC: 25, acVrms: 0.5 }]
    ])
    for (const selection of support.supportSelectionEvidence.capacitorSelections) {
      const expected = expectedDcBias.get(selection.mpn)
      expect(expected).toBeDefined()
      expect(selection.dcBias).toMatchObject({
        characteristic: "c_dcbias_capacitance",
        sourcePartNumber: expected?.sourcePartNumber,
        sampleTemperatureC: expected?.temperatureC,
        sampleAcVrms: expected?.acVrms
      })
      const response = JSON.parse(readFileSync(new URL(selection.dcBias.archivePath, packageRoot), "utf8")) as {
        JsonCharaData: Array<{
          partnumber: string
          chara_type: string
          WorkInfo: { tc: string; ac: string }
          charadata: Array<{ y_subunit: string; data: Array<[[number], [number]]> }>
        }>
      }
      const characteristic = response.JsonCharaData[0]
      expect(characteristic).toBeDefined()
      expect(characteristic?.partnumber).toBe(expected?.sourcePartNumber)
      expect(characteristic?.chara_type).toBe("c_dcbias_capacitance")
      expect(characteristic?.WorkInfo).toEqual({
        tc: String(expected?.temperatureC),
        ac: String(expected?.acVrms)
      })
      const sample = characteristic?.charadata[0]?.data.find((point) => point[0][0] === selection.dcBias.sampleBiasV)
      const sampleUf =
        characteristic?.charadata[0]?.y_subunit === "p" ? (sample?.[1][0] ?? 0) / 1_000_000 : sample?.[1][0]
      expect(sampleUf).toBe(selection.dcBias.sampleCapacitanceUf)
    }
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
      (candidate: any) => (candidate.bypassAndBulk.esp32.values[1] = "10 uF minimum effective ceramic"),
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
