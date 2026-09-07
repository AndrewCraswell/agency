import { describe, expect, it } from "vitest"
import { extractGovInfoPreformattedText } from "./committee-granule-text.js"
import { parseGovInfoHistoricalCommitteeGranule } from "./committee-historical-parser.js"

const title = "STANDING COMMITTEES OF THE SENATE"
const fixture = `${title}\n\n                   Agriculture\n\n              328A Office Building, phone 224-2035\n\n                 Richard G. Lugar, of Indiana, Chairman\n\nRick Santorum, of Pennsylvania.      Tom Harkin, of Iowa.\nMary L. Landrieu, of Louisiana.      Patrick J. Leahy, of Vermont.\n\n                              SUBCOMMITTEES\n\n                     Forestry and Conservation\n\n                         Mr. Santorum, Chairman\n\nMs. Landrieu                           Mr. Leahy\n\n                                  STAFF\n\n        Director.--Somebody Else.\n`
describe("historical GovInfo printed rosters", () => {
  it("resolves printed T. Davis and D. Davis only against unique initial-qualified parent surnames", () => {
    const houseTitle = "STANDING COMMITTEES OF THE HOUSE"
    const source = `${houseTitle}\n\nGovernment Reform and Oversight\n\nThomas M. Davis, III, of Virginia.\nDanny K. Davis, of Illinois.\nTaylor McDavis, of Ohio.\n\nSUBCOMMITTEES\n\nDistrict of Columbia\n\nMr. T. Davis, Chairman\n\nGovernment Management, Information and Technology\n\nMr. T. Davis\nMr. D. Davis\n`
    const parse = (text: string) =>
      parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title: houseTitle, text })
    const records = parse(source)
    expect(records[1]?.members).toEqual([
      { chamber: "lower", name: "Thomas M. Davis, III", state: "VA", role: "chair" }
    ])
    expect(records[2]?.members).toEqual([
      { chamber: "lower", name: "Thomas M. Davis, III", state: "VA" },
      { chamber: "lower", name: "Danny K. Davis", state: "IL" }
    ])
    for (const changed of [
      source.replace("Thomas M. Davis, III, of Virginia.\n", ""),
      source.replace("Mr. T. Davis, Chairman", "Mr. X. Davis, Chairman"),
      source.replace("Mr. T. Davis, Chairman", "Mr. T. M. Davis, Chairman"),
      source.replace("Mr. T. Davis, Chairman", "Mr. Davis, Chairman"),
      source.replace("\n\nSUBCOMMITTEES", "\nTim Davis, of New York.\n\nSUBCOMMITTEES")
    ]) {
      expect(() => parse(changed)).toThrow("Ambiguous GovInfo abbreviated member")
    }
    // An external assignment resolver cannot override the explicit initial or
    // choose between two equally qualified parent members.
    for (const changed of [
      source.replace("Thomas M. Davis, III, of Virginia.\n", ""),
      source.replace("\n\nSUBCOMMITTEES", "\nTim Davis, of New York.\n\nSUBCOMMITTEES"),
      source.replace("Mr. T. Davis, Chairman", "Mr. T. M. Davis, Chairman")
    ]) {
      expect(() =>
        parseGovInfoHistoricalCommitteeGranule(
          { chamber: "lower", title: houseTitle, text: changed },
          { resolveAbbreviatedMember: () => ({ chamber: "lower", name: "Danny K. Davis", state: "IL" }) }
        )
      ).toThrow("Ambiguous GovInfo abbreviated member")
    }
  })
  it("requires unique same-granule state evidence for the incomplete Sanders Government Reform row", () => {
    const houseTitle = "STANDING COMMITTEES OF THE HOUSE"
    const source = `${houseTitle}\n\nBanking and Financial Services\n\nDonald A. Manzullo, of Illinois.    Bernard Sanders, of Vermont.\n\nSTAFF\n\nGovernment Reform and Oversight\n\nBob Barr, of Georgia.    Bernard Sanders\nRob Portman, of Ohio.\n`
    const parse = (text: string) =>
      parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title: houseTitle, text })
    const result = parse(source)
    expect(result[1]).toMatchObject({ name: "Government Reform and Oversight", classification: "committee" })
    expect(result[1]?.members).toEqual([
      { chamber: "lower", name: "Bob Barr", state: "GA" },
      { chamber: "lower", name: "Rob Portman", state: "OH" },
      { chamber: "lower", name: "Bernard Sanders", state: "VT" }
    ])
    for (const changed of [
      source.replace("    Bernard Sanders, of Vermont.", ""),
      source.replace("Bernard Sanders, of Vermont.", "Bernard Sanders, of New York."),
      source.replace("Bernard Sanders, of Vermont.", "John Bernard Sanders, of Vermont."),
      source.replace("\n\nSTAFF", "\nBernard Sanders, of New York.\n\nSTAFF"),
      source.replace("Government Reform and Oversight", "Resources"),
      source.replace("    Bernard Sanders\n", "    Bernie Sanders\n")
    ]) {
      expect(() => parse(changed)).toThrow("Unparsed GovInfo historical roster entry")
    }
  })
  it("preserves Roemer and both touching 105th Education subcommittee boundaries", () => {
    const houseTitle = "STANDING COMMITTEES OF THE HOUSE"
    const source = `${houseTitle}\n\nEducation and the Workforce\n\nTim Roemer, of Indiana.\nCass Ballenger, of North Carolina.\nHarris W. Fawell, of Illinois.\nJohn F. Tierney, of Massachusetts.\n\nSUBCOMMITTEES\n\nEarly Childhood, Youth and Families\n\n           Mr. Ballenger    Mr. Roemer\n                     Employer-Employee Relations\n                        Mr. Fawell, Chairman\n\n           Mr. Ballenger    Mr. Tierney\n                      Oversight and Investigations\n                        Mr. Ballenger, Chairman\n\nMr. Roemer\n`
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title: houseTitle, text: source })
    expect(result.map((record) => [record.name, record.parentName])).toEqual([
      ["Education and the Workforce", undefined],
      ["Early Childhood, Youth and Families", "Education and the Workforce"],
      ["Employer-Employee Relations", "Education and the Workforce"],
      ["Oversight and Investigations", "Education and the Workforce"]
    ])
    expect(result[1]?.members.map((member) => member.name)).toEqual(["Cass Ballenger", "Tim Roemer"])
    expect(result[2]?.members.map((member) => member.name)).toEqual([
      "Harris W. Fawell",
      "Cass Ballenger",
      "John F. Tierney"
    ])
    expect(result[3]?.members.map((member) => member.name)).toEqual(["Cass Ballenger", "Tim Roemer"])
  })
  it("accepts Pallone's Commerce snapshot only with its exact 105th election footnote", () => {
    const houseTitle = "STANDING COMMITTEES OF THE HOUSE"
    const note =
      "1 Representative Frank Pallone, Jr. (D–NJ) was elected to the Committee on Commerce for the 105th Congress on\nFebruary 13, 1997, pursuant to H. Res. 58, which passed the House on February 13, 1997. Previously, Mr. Pallone\nhad been on sabbatical leave from the Committee since the beginning of the 105th Congress."
    const source = `${houseTitle}\n\nCommerce\n\nCliff Stearns, of Florida.    Frank Pallone, Jr., of New Jersey.1\n\n${note}\n\nSUBCOMMITTEES\n\nHealth and Environment\n\nMr. Pallone\n`
    const parse = (text: string) =>
      parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title: houseTitle, text })
    const records = parse(source)
    expect(records.map((record) => record.name)).toEqual(["Commerce", "Health and Environment"])
    expect(records[0]?.members).toEqual([
      { chamber: "lower", name: "Cliff Stearns", state: "FL" },
      { chamber: "lower", name: "Frank Pallone, Jr.", state: "NJ" }
    ])
    expect(records[1]?.members).toEqual([{ chamber: "lower", name: "Frank Pallone, Jr.", state: "NJ" }])
    for (const changed of [
      source.replace(note, ""),
      source.replace("was elected", "was not elected"),
      source.replace("February 13, 1997", "February 14, 1997"),
      source.replace("had been on sabbatical leave", "remains on sabbatical leave"),
      source.replace("Frank Pallone, Jr., of", "Another Pallone, Jr., of"),
      source.replace("of New Jersey.1", "of New York.1"),
      source.replace("\n\nCommerce\n", "\n\nResources\n"),
      source.replace("New Jersey.1", "New Jersey.2"),
      source.replace("1 Representative", "2 Representative")
    ]) {
      expect(() => parse(changed)).toThrow("Unrecognized GovInfo membership role")
    }
  })
  it("matches Ney only at a whole surname boundary, not McKinney, Feeney, or Tierney", () => {
    const source = `${title}\n\nBanking and Financial Services\n\nRobert W. Ney, of Ohio.\nCynthia McKinney, of Georgia.\nTom Feeney, of Florida.\nJohn F. Tierney, of Massachusetts.\n\nSUBCOMMITTEES\n\nHousing\n\nMr. Ney, Chairman\n`
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
    expect(result[1]?.members).toEqual([{ chamber: "lower", name: "Robert W. Ney", state: "OH", role: "chair" }])
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "lower",
        title,
        text: source.replace("Robert W. Ney, of Ohio.\n", "")
      })
    ).toThrow("Ambiguous GovInfo abbreviated member Mr. Ney")
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "lower",
        title,
        text: source.replace("SUBCOMMITTEES", "Another Ney, of Oregon.\n\nSUBCOMMITTEES")
      })
    ).toThrow("Ambiguous GovInfo abbreviated member Mr. Ney")
  })
  it.each([
    ["Lucille Roybal-Allard", "Roybal-Allard"],
    ["Eligio de la Garza", "de la Garza"],
    ["Robert W. Ney, Jr.", "Ney"]
  ])("preserves the complete normalized surname boundary for %s", (full, abbreviated) => {
    const source = `${title}\n\nAgriculture\n\n${full}, of Texas.\n\nSUBCOMMITTEES\n\nResearch\n\nMr. ${abbreviated}\n`
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
    expect(result[1]?.members).toEqual([{ chamber: "lower", name: full, state: "TX" }])
  })
  it.each(["’", "'"])("joins the same-column Speaker%ss Designee wrap without assigning a chair role", (apostrophe) => {
    const source = `${title}\n\nBudget\n\nSaxby Chambliss, of Georgia (Speaker${apostrophe}s    John M. Spratt Jr., of South Carolina.\n  Designee).    Jim McDermott, of Washington.\nChristopher Shays, of Connecticut.    Lynn N. Rivers, of Michigan.\n`
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
    expect(result[0]?.members).toEqual([
      { chamber: "lower", name: "Saxby Chambliss", state: "GA" },
      { chamber: "lower", name: "Christopher Shays", state: "CT" },
      { chamber: "lower", name: "John M. Spratt Jr.", state: "SC" },
      { chamber: "lower", name: "Jim McDermott", state: "WA" },
      { chamber: "lower", name: "Lynn N. Rivers", state: "MI" }
    ])
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "lower",
        title,
        text: source.replace(` (Speaker${apostrophe}s`, "")
      })
    ).toThrow("Unparsed GovInfo historical roster entry: Designee).")
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "lower",
        title,
        text: source.replace("Designee).", "Unknown).")
      })
    ).toThrow("Unrecognized GovInfo membership role")
  })
  it.each(["1 vacancy", "2 vacancies"])(
    "keeps the numbered vacancy %s out of a member name and preserves the neighboring column",
    (annotation) => {
      const source = `${title}\n\nBanking and Financial Services\n\nTom Campbell, of California.    Melvin L. Watt, of North Carolina.\nGary L. Ackerman, of New York.\n\nSUBCOMMITTEES\n\nCapital Markets, Securities and Government Sponsored Enterprises\n\nMr. Campbell    Mr. Watt\n${annotation}      Mr. Ackerman\n`
      const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
      expect(result[1]?.members).toEqual([
        { chamber: "lower", name: "Tom Campbell", state: "CA" },
        { chamber: "lower", name: "Melvin L. Watt", state: "NC" },
        { chamber: "lower", name: "Gary L. Ackerman", state: "NY" }
      ])
      expect(() =>
        parseGovInfoHistoricalCommitteeGranule({
          chamber: "lower",
          title,
          text: source.replace(annotation, "1 unexplained entry")
        })
      ).toThrow("Ambiguous GovInfo abbreviated member Mr. Campbell 1 unexplained entry")
    }
  )
  it("keeps Dr. Frist separate from the preceding Gregg row and resolves only the unique parent", () => {
    const source = `${title}\n\nLabor and Human Resources\n\nJudd Gregg, of New Hampshire.    Christopher J. Dodd, of Connecticut.\nBill Frist, of Tennessee.    Jeff Bingaman, of New Mexico.\n\nSUBCOMMITTEES\n\nChildren and Families\n\nMr. Gregg    Mr. Dodd\nDr. Frist    Mr. Bingaman\n`
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[1]?.members).toEqual([
      { chamber: "upper", name: "Judd Gregg", state: "NH" },
      { chamber: "upper", name: "Bill Frist", state: "TN" },
      { chamber: "upper", name: "Christopher J. Dodd", state: "CT" },
      { chamber: "upper", name: "Jeff Bingaman", state: "NM" }
    ])
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "upper",
        title,
        text: source.replace("SUBCOMMITTEES", "Another Frist, of Ohio.\n\nSUBCOMMITTEES")
      })
    ).toThrow("Ambiguous GovInfo abbreviated member Dr. Frist")
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "upper",
        title,
        text: source.replace("Bill Frist, of Tennessee.", "Another Person, of Tennessee.")
      })
    ).toThrow("Ambiguous GovInfo abbreviated member Dr. Frist")
  })
  it("recognizes a standalone Dr. chair block and preserves its role", () => {
    const source = fixture.replace("Mr. Santorum, Chairman", "Dr. Santorum, Chairman")
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[1]?.members[0]).toEqual({ chamber: "upper", name: "Rick Santorum", state: "PA", role: "chair" })
  })
  it("keeps state-spelling corroboration inside the printed name's column", () => {
    const source = `${title}\n\nCommittee on Indian Affairs\n\nJohn McCain, of Arizona.    Michael E. Capuano, of Masschusetts.\nMichael E. Capuano, of Massachusetts.\n`
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[0]?.members).toEqual([
      { chamber: "upper", name: "John McCain", state: "AZ" },
      { chamber: "upper", name: "Michael E. Capuano", state: "MA" },
      { chamber: "upper", name: "Michael E. Capuano", state: "MA" }
    ])
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "upper",
        title,
        text: source.replace("Michael E. Capuano, of Massachusetts.", "Unrelated Person, of Massachusetts.")
      })
    ).toThrow("Uncorroborated GovInfo state spelling: Michael E. Capuano")
  })
  it.each(["Majority Staff Director/Chief Counsel.—Paul Moorehead.", "Majority Staff Director.—Gary Bohnee."])(
    "separates the touching staff label %s without dropping the last member",
    (staffLabel) => {
      const source = `${title}\n\nCommittee on Indian Affairs\n\nBen Nighthorse Campbell, of Colorado, Chairman.\nJames M. Inhofe, of Oklahoma.\n   Majority Staff Director/Chief Counsel.—Paul Moorehead.\n   Legislative Aide.—Theresa Rosier.\n\nSelect Committee on Ethics\n\nBOB SMITH, of New Hampshire, Chairman.\nHarry Reid, of Nevada, Vice Chairman.\n  Staff Director/Chief Counsel.—Victor Baird.\n   Counsels: Elizabeth A. Ryan.\n`
      const printedSource = source.replace("Majority Staff Director/Chief Counsel.—Paul Moorehead.", staffLabel)
      const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: printedSource })
      expect(result.map((record) => [record.name, record.classification, record.members.length])).toEqual([
        ["Committee on Indian Affairs", "committee", 2],
        ["Select Committee on Ethics", "committee", 2]
      ])
      expect(result[0]?.members.at(-1)).toEqual({ chamber: "upper", name: "James M. Inhofe", state: "OK" })
      expect(() =>
        parseGovInfoHistoricalCommitteeGranule({
          chamber: "upper",
          title,
          text: printedSource.replace(staffLabel, "Unexplained roster entry.")
        })
      ).toThrow("Unparsed GovInfo historical roster entry")
    }
  )
  it.each([
    ["Mississppi", "Mississippi", "MS"],
    ["Masschusetts", "Massachusetts", "MA"]
  ])("corrects printed %s only with the same person's corroborating state", (typo, state, code) => {
    const source = fixture
      .replace("Richard G. Lugar, of Indiana, Chairman", `Richard G. Lugar, of ${typo}, Chairman`)
      .replace("Mary L. Landrieu, of Louisiana.", `Richard G. Lugar, of ${state}.`)
    const parentOnly = source.split("                              SUBCOMMITTEES")[0] ?? ""
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: parentOnly })
    expect(result[0]?.members[0]).toMatchObject({ name: "Richard G. Lugar", state: code, role: "chair" })
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "upper",
        title,
        text: parentOnly.replace(`Richard G. Lugar, of ${state}.`, `Unrelated Person, of ${state}.`)
      })
    ).toThrow("Uncorroborated GovInfo state spelling")
  })
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
  it.each([
    ["Oversight of Government Management, the Federal Workforce and the", "District of Columbia (OGM)"],
    ["Federal Financial Management, Government Information, Federal Services, and", "International Security (FFM)"]
  ])("preserves a conjunction-ended printed heading across blank lines: %s", (first, second) => {
    const source = fixture.replace("Forestry and Conservation", `${first}\n\n                  ${second}`)
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[1]?.name).toBe(`${first} ${second}`)
    expect(result[1]?.members).toHaveLength(3)
  })
  it("removes the footnote marker from the printed Children and Families heading", () => {
    const source = fixture.replace("Forestry and Conservation", "* Children and Families")
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[1]?.name).toBe("Children and Families")
    expect(result[1]?.members).toHaveLength(3)
  })
  it("keeps a touching vacant-chair annotation out of the heading", () => {
    const source = fixture.replace(
      "Forestry and Conservation\n\n                         Mr. Santorum, Chairman",
      "Investigations, Oversight and Regulations\n               Vacant, Chair"
    )
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[1]?.name).toBe("Investigations, Oversight and Regulations")
    expect(result[1]?.members).toHaveLength(2)
  })
  it("ignores a standalone accent cell without dropping its adjacent member", () => {
    const source = fixture.replace(
      "Mary L. Landrieu, of Louisiana.      Patrick J. Leahy, of Vermont.",
      "Mary L. Landrieu, of Louisiana.      ´\n                                      Patrick J. Leahy, of Vermont."
    )
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result[0]?.members).toHaveLength(5)
    expect(result[0]?.members).toContainEqual({ chamber: "upper", name: "Patrick J. Leahy", state: "VT" })
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
  it("keeps Aging and the Year 2000 committee separate from the printed reauthorization note", () => {
    const source = `${title}\n\nSpecial Committee on Aging\n\nReauthorized pursuant to S. Res. 4, 95th Congress\n\nG–31 Dirksen Senate Office Building, phone 224–5364\n\nCharles E. Grassley, of Iowa, Chairman.\nJohn B. Breaux, of Louisiana.\n\n   Staff Director.—Ted Totman.\n\nSpecial Committee on the Year 2000 Technology Problem\n\nB–40 Dirksen Senate Office Building, phone 224–5224\n\nBob Bennett, of Utah, Chairman.\nChristopher J. Dodd, of Connecticut, Vice Chairman.\n`
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "upper", title, text: source })
    expect(result.map((record) => [record.name, record.classification, record.members.length])).toEqual([
      ["Special Committee on Aging", "committee", 2],
      ["Special Committee on the Year 2000 Technology Problem", "committee", 2]
    ])
    expect(result[0]?.members[0]).toMatchObject({ name: "Charles E. Grassley", role: "chair" })
    expect(result[1]?.members[0]).toMatchObject({ name: "Bob Bennett", role: "chair" })
  })
  it("preserves the right column when a detached period precedes a wrapped state", () => {
    const source = `${title}\n\nDistrict of Columbia\n\nThomas M. Davis III, of Virginia.    Eleanor Holmes Norton, of the District of\n.    Columbia.\n                                 Diane E. Watson, of California.\n`
    const result = parseGovInfoHistoricalCommitteeGranule({ chamber: "lower", title, text: source })
    expect(result[0]?.members).toEqual([
      { chamber: "lower", name: "Thomas M. Davis III", state: "VA" },
      { chamber: "lower", name: "Eleanor Holmes Norton", state: "DC" },
      { chamber: "lower", name: "Diane E. Watson", state: "CA" }
    ])
    expect(() =>
      parseGovInfoHistoricalCommitteeGranule({
        chamber: "lower",
        title,
        text: source.replace(".    Columbia.", ".    Unknown.")
      })
    ).toThrow("Unparsed GovInfo historical roster entry")
  })
})
