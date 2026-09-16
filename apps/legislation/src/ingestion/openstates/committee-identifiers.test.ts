import { expect, it } from "vitest"
import { alaskaCommitteeIdentifiers } from "./committee-identifiers.js"

it("retains both session identities independently from homepage selection", () => {
  expect(
    alaskaCommitteeIdentifiers(
      [
        { url: "https://www.akleg.gov/basis/Committee/Details/33?code=SL%26C", note: "homepage" },
        { url: "https://www.akleg.gov/basis/Committee/Details/34?code=SL%26C" }
      ],
      "upper"
    )
  ).toEqual({
    "akCommittee:33:SL&C": "https://www.akleg.gov/basis/Committee/Details/33?code=SL%26C",
    "akCommittee:34:SL&C": "https://www.akleg.gov/basis/Committee/Details/34?code=SL%26C"
  })
})
it("rejects wrong chamber, host, credentials and malformed unescaped identifiers", () => {
  for (const url of [
    "https://www.akleg.gov/basis/Committee/Details/34?code=HL%26C",
    "https://example.org/basis/Committee/Details/34?code=SL%26C",
    "https://user:secret@www.akleg.gov/basis/Committee/Details/34?code=SL%26C",
    "https://www.akleg.gov/basis/Committee/Details/34?code=SL&C"
  ]) {
    expect(alaskaCommitteeIdentifiers([{ url }], "upper")).toEqual({})
  }
})
