import { digest, unitIdentity } from "@repo/legislation-core/legal-text/contracts"
import { expect, it } from "vitest"
import { planEcfrDiscoveryPage } from "./ecfr-discovery.js"

function fixture(options: { importInProgress?: boolean } = {}) {
  const titles = Array.from({ length: 50 }, (_, index) => ({
    number: index + 1,
    name: `Title ${index + 1}`,
    reserved: index === 1,
    latest_issue_date: index === 1 ? null : "2026-09-10",
    latest_amended_on: index === 1 ? null : "2026-09-09",
    up_to_date_as_of: index === 1 ? null : "2026-09-11"
  }))
  const body = JSON.stringify({
    titles,
    meta: { date: "2026-09-11", import_in_progress: options.importInProgress ?? false }
  })
  return {
    body,
    titles,
    evidence: {
      sourceId: "ecfr" as const,
      url: "https://www.ecfr.gov/api/versioner/v1/titles.json",
      sha256: digest(body),
      bytes: Buffer.byteLength(body),
      contentType: "application/json",
      body,
      retrievedAt: "2026-09-16T23:00:00.000Z"
    }
  }
}

it("registers only changed non-reserved titles with current-source identities", () => {
  const data = fixture()
  const titleOne = data.titles[0]!
  const result = planEcfrDiscoveryPage({
    evidence: data.evidence,
    titles: [3, 2, 1],
    current: [
      {
        title: 1,
        sourceRevision: digest(JSON.stringify(titleOne)),
        issueDate: titleOne.latest_issue_date,
        currencyDate: titleOne.up_to_date_as_of
      }
    ]
  })
  expect(result.unchanged).toEqual([1])
  expect(result.reserved).toEqual([2])
  expect(result.units).toHaveLength(1)
  expect(result.units[0]).toMatchObject({
    sourceId: "ecfr",
    nativeId: "title-3",
    historical: false,
    issueDate: "2026-09-10",
    currencyDate: "2026-09-11"
  })
  expect(result.units[0]?.key).toBe(unitIdentity(result.units[0]!))
})

it("does not accept incomplete or internally inconsistent publisher inventories", () => {
  const importing = fixture({ importInProgress: true })
  expect(() => planEcfrDiscoveryPage({ evidence: importing.evidence, titles: [1], current: [] })).toThrow(
    "ecfr_inventory_import_in_progress"
  )
  const invalid = fixture()
  invalid.titles[0]!.up_to_date_as_of = "2026-09-09"
  invalid.body = JSON.stringify({ titles: invalid.titles, meta: { date: "2026-09-11", import_in_progress: false } })
  invalid.evidence.body = invalid.body
  invalid.evidence.sha256 = digest(invalid.body)
  invalid.evidence.bytes = Buffer.byteLength(invalid.body)
  expect(() => planEcfrDiscoveryPage({ evidence: invalid.evidence, titles: [1], current: [] })).toThrow(
    "ecfr_discovery_date_invalid"
  )
  const duplicate = fixture()
  duplicate.titles[49]!.number = 49
  duplicate.body = JSON.stringify({
    titles: duplicate.titles,
    meta: { date: "2026-09-11", import_in_progress: false }
  })
  duplicate.evidence.body = duplicate.body
  duplicate.evidence.sha256 = digest(duplicate.body)
  duplicate.evidence.bytes = Buffer.byteLength(duplicate.body)
  expect(() => planEcfrDiscoveryPage({ evidence: duplicate.evidence, titles: [1], current: [] })).toThrow(
    "ecfr_inventory_titles_invalid"
  )
})
