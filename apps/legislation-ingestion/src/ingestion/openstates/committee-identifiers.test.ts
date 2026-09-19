import { expect, it } from "vitest"
import {
  alaskaCommitteeIdentifiers,
  northCarolinaCommitteeIdentifiers,
  washingtonCommitteeIdentifiers
} from "./committee-identifiers.js"

it("maps Washington official chamber codes without guessing committee names", () => {
  const url = "https://leg.wa.gov/about-the-legislature/committees/senate/lgv"
  expect(washingtonCommitteeIdentifiers([{ url }], "upper")).toEqual({ "waCommittee:senate:LGV": url })
  expect(washingtonCommitteeIdentifiers([{ url }], "lower")).toEqual({})
  const house = "https://leg.wa.gov/House/Committees/PEW"
  expect(washingtonCommitteeIdentifiers([{ url: house }], "lower")).toEqual({ "waCommittee:house:PEW": house })
  const currentHouse = "https://leg.wa.gov/about-the-legislature/committees/house-of-representatives/cs"
  expect(washingtonCommitteeIdentifiers([{ url: currentHouse }], "lower")).toEqual({
    "waCommittee:house:CS": currentHouse
  })
  for (const invalid of [
    url + "?other=1",
    url + "#fragment",
    url.replace("leg.wa.gov", "example.org"),
    url.replace("https://", "https://user@")
  ]) {
    expect(washingtonCommitteeIdentifiers([{ url: invalid }], "upper")).toEqual({})
  }
})

it("maps explicit Washington joint committee URL codes only to legislative committees", () => {
  const url = "https://leg.wa.gov/about-the-legislature/committees/joint/vma"
  expect(washingtonCommitteeIdentifiers([{ url }], "legislature")).toEqual({ "waCommittee:joint:VMA": url })
  for (const chamber of ["upper", "lower", null]) {
    expect(washingtonCommitteeIdentifiers([{ url }], chamber)).toEqual({})
  }
  for (const invalid of [url + "?code=OTHER", url + "#fragment", url.replace("leg.wa.gov", "example.org")]) {
    expect(washingtonCommitteeIdentifiers([{ url: invalid }], "legislature")).toEqual({})
  }
})

it.each([
  ["https://leg.wa.gov/about-the-legislature/legislative-agencies/jlarc", "JLARC"],
  ["https://leg.wa.gov/about-the-legislature/legislative-agencies/leb", "LEB"],
  ["https://leg.wa.gov/JTC/Pages/default.aspx", "JTC"]
])("maps joint roster agency codes from %s without inferring the committee from its name", (url, code) => {
  expect(washingtonCommitteeIdentifiers([{ url }], "legislature")).toEqual({ [`waCommittee:joint:${code}`]: url })
  expect(washingtonCommitteeIdentifiers([{ url }], "upper")).toEqual({})
  expect(washingtonCommitteeIdentifiers([{ url }], "lower")).toEqual({})
  for (const invalid of [url + "?other=1", url + "#fragment", url.replace("leg.wa.gov", "example.org")]) {
    expect(washingtonCommitteeIdentifiers([{ url: invalid }], "legislature")).toEqual({})
  }
})

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
