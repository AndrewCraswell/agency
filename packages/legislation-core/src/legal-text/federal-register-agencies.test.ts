import { expect, it } from "vitest"
import { projectFederalRegisterAgencyReferences } from "./federal-register-agencies"

it("uses publisher IDs and document-scoped identities without resolving organizations", () => {
  const projected = projectFederalRegisterAgencyReferences("2000-100", [
    { id: 406, raw_name: "Personnel Management Office", parent_id: null },
    { raw_name: "Independent Office" },
    { raw_name: " " }
  ])
  expect(projected[0]).toMatchObject({
    identityBasis: "publisher_id",
    reference: { sourceAgencyId: "fr-agency-406", organizationId: null, status: "unresolved" }
  })
  expect(projected[1]?.reference?.sourceAgencyId).toMatch(/^fr-agency-unidentified-[a-f0-9]{64}$/)
  expect(projected[2]).toMatchObject({ reference: null, reason: "missing_source_agency_name" })
  expect(
    projectFederalRegisterAgencyReferences("2000-101", [{ raw_name: "Independent Office" }])[0]?.reference
      ?.sourceAgencyId
  ).not.toBe(projected[1]?.reference?.sourceAgencyId)
})
