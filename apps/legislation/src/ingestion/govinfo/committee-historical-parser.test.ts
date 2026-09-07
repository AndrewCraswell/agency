import { describe, expect, it } from "vitest"
import { extractGovInfoPreformattedText } from "./committee-granule-text.js"
import { parseGovInfoHistoricalCommitteeGranule } from "./committee-historical-parser.js"

const title = "STANDING COMMITTEES OF THE SENATE"
const fixture = `${title}\n\n                   Agriculture\n\n              328A Office Building, phone 224-2035\n\n                 Richard G. Lugar, of Indiana, Chairman\n\nRick Santorum, of Pennsylvania.      Tom Harkin, of Iowa.\nMary L. Landrieu, of Louisiana.      Patrick J. Leahy, of Vermont.\n\n                              SUBCOMMITTEES\n\n                     Forestry and Conservation\n\n                         Mr. Santorum, Chairman\n\nMs. Landrieu                           Mr. Leahy\n\n                                  STAFF\n\n        Director.--Somebody Else.\n`
describe("historical GovInfo printed rosters", () => {
  it("resolves abbreviations only against the parent roster and preserves roles", () => {
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: fixture })
    expect(result).toHaveLength(2)
    expect(result[0]?.members).toHaveLength(5)
    expect(result[1]).toMatchObject({
      classification: "subcommittee",
      parentName: "Agriculture",
      name: "Forestry and Conservation",
      members: [
        { name: "Rick Santorum", state: "PA", role: "chair" },
        { name: "Mary L. Landrieu", state: "LA" },
        { name: "Patrick J. Leahy", state: "VT" }
      ]
    })
  })
  it("rejects ambiguous abbreviations instead of selecting a person", () => {
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "upper",
        title,
        text: fixture.replace("Mary L. Landrieu", "Alex Santorum")
      })
    ).toThrow("Ambiguous")
  })
  it("rejects partially parsed member cells", () => {
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "upper",
        title,
        text: fixture.replace("Tom Harkin, of Iowa.", "Tom Harkin, of Unknown.")
      })
    ).toThrow("Unparsed")
  })
  it("ends legislative scope before the named national party committee", () => {
    const source =
      fixture +
      "\n         National Republican Congressional Committee\n\nTom Emmer, of Minnesota, Chair\n\nVice Chair of:\nFinance.--Richard Hudson, of North Carolina.\n"
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result).toHaveLength(2)
    expect(result.flatMap((record) => record.members).some((member) => member.name.includes("Emmer"))).toBe(false)
  })
  it("retains a wrapped Northern Mariana Islands member independently of its neighboring column", () => {
    const source =
      fixture
        .replace(
          "Rick Santorum, of Pennsylvania.      Tom Harkin, of Iowa.",
          "Gregorio Kilili Camacho Sablan, of Northern    Tom Harkin, of Iowa.\n        Mariana Islands."
        )
        .split("                              SUBCOMMITTEES")[0] ?? ""
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
    expect(result[0]?.members).toContainEqual({ chamber: "lower", name: "Gregorio Kilili Camacho Sablan", state: "MP" })
    expect(result[0]?.members).toHaveLength(5)
  })
  it("keeps an inline subcommittee heading within its parent when no SUBCOMMITTEES banner is printed", () => {
    const source = fixture
      .replace("                              SUBCOMMITTEES\n\n", "")
      .replace("Forestry and Conservation\n\n", "Forestry and Conservation\n")
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[1]).toMatchObject({
      classification: "subcommittee",
      name: "Forestry and Conservation",
      parentName: "Agriculture"
    })
  })
  it("treats Ex Officio as a membership role, not an organization", () => {
    const source = fixture.replace(
      "                              SUBCOMMITTEES",
      "                         Ex Officio\n\n                 Alex Person, of Oregon.\n\n                              SUBCOMMITTEES"
    )
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result).toHaveLength(2)
    expect(result[0]?.members).toContainEqual({
      chamber: "upper",
      name: "Alex Person",
      state: "OR",
      role: "ex-officio"
    })
    expect(result[1]?.members[0]?.role).toBe("chair")
  })
  it("ignores the explicit absent-vice-chair note and isolated punctuation", () => {
    const source = fixture
      .replace(
        "Richard G. Lugar, of Indiana, Chairman",
        "Richard G. Lugar, of Indiana, Chairman\n                         (No Vice Chairman)"
      )
      .replace("Mary L. Landrieu, of Louisiana.", ".\nMary L. Landrieu, of Louisiana.")
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[0]?.members).toHaveLength(5)
    expect(result[0]?.members[0]?.role).toBe("chair")
  })
  it("accepts the printed article before District of Columbia", () => {
    const source = fixture.replace(
      "Richard G. Lugar, of Indiana, Chairman",
      "Eleanor Holmes Norton, of the District of Columbia, Chair"
    )
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
    expect(result[0]?.members[0]).toEqual({
      chamber: "lower",
      name: "Eleanor Holmes Norton",
      state: "DC",
      role: "chair"
    })
  })
  it("removes a detached acute mark after the name comma without dropping the member", () => {
    const source = fixture.replace(
      "Richard G. Lugar, of Indiana, Chairman",
      "Peter J. Visclosky,´    of Indiana, Chairman"
    )
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
    expect(result[0]?.members[0]).toEqual({ chamber: "lower", name: "Peter J. Visclosky", state: "IN", role: "chair" })
  })
  it("attaches the printed Speaker's Designee vice-chair continuation to its member", () => {
    const source = fixture.replace(
      "Richard G. Lugar, of Indiana, Chairman",
      "Christopher Shays, of Connecticut\n                   (Speaker’s Designee / Vice Chairman)."
    )
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
    expect(result[0]?.members[0]).toEqual({
      chamber: "lower",
      name: "Christopher Shays",
      state: "CT",
      role: "vice-chair"
    })
  })
  it("accepts only the advertised preformatted text, not generic HTML fallback", () => {
    expect(extractGovInfoPreformattedText(`<html><pre>${fixture}</pre></html>`, title)).toBe(fixture)
    expect(() => extractGovInfoPreformattedText("<html>Not found</html>", title)).toThrow("preformatted")
    expect(() => extractGovInfoPreformattedText("<pre>Other document</pre>", title)).toThrow("heading")
  })
  it("ignores the explicit no-subcommittees note without changing roster members", () => {
    const source = fixture.replace(
      "Mary L. Landrieu, of Louisiana.",
      "(No Subcommittees)\nMary L. Landrieu, of Louisiana."
    )
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    const baseline = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: fixture })
    expect(result).toHaveLength(baseline.length)
    expect(result[0]?.members).toHaveLength(5)
    expect(result[0]?.members).toEqual(expect.arrayContaining(baseline[0]?.members ?? []))
    expect(result[1]).toEqual(baseline[1])
  })
  it("ignores an isolated PDF accent glyph without losing a member", () => {
    const source = fixture.replace(
      "Rick Santorum, of Pennsylvania.",
      "                      ´\nRick Santorum, of Pennsylvania."
    )
    expect(parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })).toEqual(
      parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: fixture })
    )
  })
  it.each(["Retirement and Aging", "Primary Health and Aging", "The Western Hemisphere"])(
    "separates the touching heading %s",
    (name) => {
      const source = fixture.replace(
        "\n\n                                  STAFF",
        `\n                    ${name}\n                  Mr. Santorum, Chairman\n\nMs. Landrieu\n\n                                  STAFF`
      )
      const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
      expect(result).toHaveLength(3)
      expect(result[1]?.members).toHaveLength(3)
      expect(result[2]).toMatchObject({ name, parentName: "Agriculture", classification: "subcommittee" })
      expect(result[2]?.members).toHaveLength(2)
    }
  )
  it.each(["Calvin M. Dooley of California.", "Bob Graham. of Florida.", "Peter Welch,´of Vermont."])(
    "reads the full printed name despite separator formatting: %s",
    (member) => {
      const source = fixture.replace("Richard G. Lugar, of Indiana, Chairman", member)
      const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
      expect(result[0]?.members).toHaveLength(5)
      expect(result[0]?.members[0]?.name).toBe(member.split(/(?:,|\. of| of)/)[0])
    }
  )
  it.each(["Department of Defense", "District of Columbia", "Indian, Insular and Alaska Native Affairs"])(
    "does not mistake a heading containing of or a state name for a person: %s",
    (name) => {
      const source = fixture.replace("Forestry and Conservation", name)
      const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
      expect(result).toHaveLength(2)
      expect(result[1]).toMatchObject({ name, parentName: "Agriculture", classification: "subcommittee" })
      expect(result[1]?.members).toHaveLength(3)
    }
  )
  it("preserves a chair whose printed state omits 'of'", () => {
    const source = fixture.replace("Richard G. Lugar, of Indiana, Chairman", "Frank A. LoBiondo, New Jersey, Chair")
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[0]?.members[0]).toEqual({ chamber: "upper", name: "Frank A. LoBiondo", state: "NJ", role: "chair" })
  })
  it("retains the organization heading across a TBD chair placeholder", () => {
    const source = fixture.replace("Mr. Santorum, Chairman", "TBD, Chair")
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[1]?.name).toBe("Forestry and Conservation")
    expect(result[1]?.members).toHaveLength(2)
  })
  it("joins the comma-ended heading continuation across a printed blank line", () => {
    const source = fixture.replace(
      "Forestry and Conservation",
      "Transportation, Housing and Urban Development,\n\n                  and Related Agencies"
    )
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[1]?.name).toBe("Transportation, Housing and Urban Development, and Related Agencies")
  })
  it("ignores a detached accent after an otherwise complete member", () => {
    const source = fixture.replace("Tom Harkin, of Iowa.", "Tom Harkin, of Iowa.´")
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[0]?.members).toContainEqual({ chamber: "upper", name: "Tom Harkin", state: "IA" })
  })
  it("excludes the National Republican Senatorial Committee at its explicit boundary", () => {
    const source = fixture + "\n National Republican Senatorial Committee\n\nJohn Person, of Iowa, Chair\n"
    expect(parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })).toHaveLength(2)
  })
  it("retains the year in a multiline legislative select committee heading after staff", () => {
    const source =
      fixture +
      "\n     Select Committee on the Events Surrounding the 2012\n                 Terrorist Attack in Benghazi\n\n 1036 Longworth House Office Building\n phone 226-7100\n\nTrey Gowdy, of South Carolina, Chair\nElijah E. Cummings, of Maryland, Ranking Member\n"
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
    expect(result.at(-1)).toMatchObject({
      name: "Select Committee on the Events Surrounding the 2012 Terrorist Attack in Benghazi",
      classification: "committee"
    })
    expect(result.at(-1)?.members).toHaveLength(2)
  })
})
