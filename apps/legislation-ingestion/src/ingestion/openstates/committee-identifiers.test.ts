import { expect, it } from "vitest"
import { alaskaCommitteeIdentifiers, northCarolinaCommitteeIdentifiers } from "./committee-identifiers.js"

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

it("derives exact North Carolina publisher committee identities without names", () => {
  expect(
    northCarolinaCommitteeIdentifiers([
      { url: "https://www.ncleg.gov/Committees/CommitteeInfo/HouseStanding/42" },
      { url: "https://www.ncleg.gov/Committees/CommitteeInfo/Senate%20Standing/17", note: "homepage" }
    ])
  ).toEqual({
    "ncCommittee:HouseStanding:42": "https://www.ncleg.gov/Committees/CommitteeInfo/HouseStanding/42",
    "ncCommittee:Senate%20Standing:17": "https://www.ncleg.gov/Committees/CommitteeInfo/Senate%20Standing/17"
  })
})

it("rejects ambiguous routes, foreign hosts, credentials and URL decorations", () => {
  for (const url of [
    "https://www.ncleg.gov/Committees/CommitteeInfo/Standing/42",
    "https://example.org/Committees/CommitteeInfo/HouseStanding/42",
    "https://user:secret@www.ncleg.gov/Committees/CommitteeInfo/HouseStanding/42",
    "https://www.ncleg.gov/Committees/CommitteeInfo/HouseStanding/42?name=Rules"
  ]) {
    expect(northCarolinaCommitteeIdentifiers([{ url }])).toEqual({})
  }
})
