import { describe, expect, it } from "vitest"
import {
  assertCanonicalIdentitiesUnique,
  billId,
  childId,
  documentSectionId,
  federalBillId,
  jurisdictionId,
  legislativeTermId,
  legislativeSessionId,
  organizationId,
  organizationMembershipId,
  personId
} from "./identifiers.js"

describe("canonical legislative identifiers", () => {
  it("normalizes state and federal bill variations to stable IDs", () => {
    expect(billId(" WA ", "2025–2026", "H.B.", "001234")).toBe("bill:wa:2025-2026:hb:1234")
    expect(federalBillId(119, "HR", 1234)).toBe("bill:us:119:hr:1234")
    expect(federalBillId(119, " h.r. ", "1234")).toBe("bill:us:119:hr:1234")
  })

  it("creates deterministic jurisdiction, session, person, child, and section IDs", () => {
    expect(jurisdictionId("PR")).toBe("jurisdiction:pr")
    expect(legislativeSessionId("DC", "26th Council Period")).toBe("session:dc:26th-council-period")
    expect(personId("Open States", "ocd-person/ABC-123")).toBe("person:open-states:ocd-person-abc-123")

    const first = childId("action", "bill:wa:2025-2026:hb:1234", "provider-action-1")
    const second = childId("action", "bill:wa:2025-2026:hb:1234", "provider-action-1")
    expect(first).toBe(second)
    expect(first).toMatch(/^bill:wa:2025-2026:hb:1234:action:[0-9a-f]{24}$/)
    expect(documentSectionId("document:1", 0, "a".repeat(64))).toMatch(/^document:1:section:[0-9a-f]{24}$/)
  })

  it("creates stable expansion entity identities", () => {
    const person = personId("openstates", "ocd-person/ABC")
    const organization = organizationId("openstates", "ocd-organization/XYZ")

    expect(organization).toBe("organization:openstates:ocd-organization-xyz")
    expect(legislativeTermId(person, "current:lower:14")).toMatch(/^person:openstates:.*:term:[0-9a-f]{24}$/)
    expect(organizationMembershipId(organization, person, "member")).toMatch(
      /^organization:openstates:.*:membership:[0-9a-f]{24}$/
    )
  })

  it("rejects empty segments and invalid numeric inputs", () => {
    expect(() => jurisdictionId("---")).toThrow("subdivision code")
    expect(() => federalBillId(0, "hr", 1)).toThrow("positive integer")
    expect(() => documentSectionId("document:1", -1, "a".repeat(64))).toThrow("nonnegative integer")
  })

  it("rejects distinct source records that collapse to one canonical identity", () => {
    expect(() =>
      assertCanonicalIdentitiesUnique([
        { canonicalId: "bill:wa:2025-2026:hb:1", sourceIdentity: "ocd-bill/one" },
        { canonicalId: "bill:wa:2025-2026:hb:1", sourceIdentity: "ocd-bill/two" }
      ])
    ).toThrow("Canonical identity collision")

    expect(() =>
      assertCanonicalIdentitiesUnique([
        { canonicalId: "bill:wa:2025-2026:hb:1", sourceIdentity: "ocd-bill/one" },
        { canonicalId: "bill:wa:2025-2026:hb:1", sourceIdentity: "ocd-bill/one" }
      ])
    ).not.toThrow()
  })
})
