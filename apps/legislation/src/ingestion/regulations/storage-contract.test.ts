import { describe, expect, it } from "vitest"
import { assertRights, officialFederalRights, rightsPolicySchema } from "./storage-contract.js"

describe("regulatory source rights", () => {
  it("requires explicit complete rights and refuses denied uses", () => {
    expect(() => rightsPolicySchema.parse({ retainRaw: true })).toThrow(/Invalid input/)
    expect(() => assertRights({ ...officialFederalRights, displayText: false }, "displayText")).toThrow("rights_denied")
    expect(() => assertRights({ ...officialFederalRights, retainRaw: false }, "retainRaw")).toThrow("rights_denied")
    expect(() => assertRights({ ...officialFederalRights, localSearch: false }, "localSearch")).toThrow("rights_denied")
  })
  it("preserves licensed attribution and termination restrictions without granting missing rights", () => {
    const licensed = {
      ...officialFederalRights,
      attribution: "Éditeur — synthetic licensed fixture",
      territories: ["US"],
      termination: "restrict",
      embeddings: false,
      apiMcp: false,
      sharing: false
    }
    expect(rightsPolicySchema.parse(licensed)).toMatchObject({
      embeddings: false,
      apiMcp: false,
      termination: "restrict"
    })
    expect(() => rightsPolicySchema.parse({ ...licensed, externalStandardsIncluded: true })).toThrow(/Invalid input/)
  })
})
