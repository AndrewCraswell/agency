import { describe, expect, it } from "vitest"
import type { EvidenceSnapshot } from "../evidence"
import { malformedCitationFixtures } from "./citationEvidenceFixtures"
import { createCitationPresentation } from "./citationPresentation"

function source(id: string, overrides: Partial<EvidenceSnapshot> = {}): EvidenceSnapshot {
  return {
    id,
    title: `Source ${id}`,
    origin: "canonical",
    sourceUrl: `https://publisher.example/${id}`,
    content: { state: "available", quote: `Passage ${id}` },
    ...overrides
  }
}

describe("citation presentation", () => {
  it("resolves omitted UUID separators only by exact registered identity", () => {
    const id = "10cf92b0-a39b-8018-a5ab-f1c0b43ef54e"
    const evidence = source(id)
    const reference = "#citation-10cf92b0a39b-8018-a5ab-f1c0b43ef54e"
    const presentation = createCitationPresentation("answer", `[1](${reference})`, [evidence])
    expect(presentation.resolveCitation(reference)).toEqual({ answerId: "answer", number: 1, evidence })
    expect(
      createCitationPresentation("answer", "[1](#citation-10cf92b0a39b8018a5abf1c0b43ef54f)", [evidence]).citations
    ).toEqual([])
    expect(createCitationPresentation("other-answer", `[1](${reference})`, []).citations).toEqual([])
  })

  it("leaves conflicting UUID representations unresolved", () => {
    const id = "10cf92b0-a39b-8018-a5ab-f1c0b43ef54e"
    const reference = `#citation-${id}`
    const presentation = createCitationPresentation("answer", `[1](${reference})`, [
      source(id),
      source(id.replaceAll("-", ""))
    ])
    expect(presentation.resolveCitation(reference)).toBeUndefined()
    expect(presentation.missingReferences).toEqual([id])
  })

  it("repairs an opaque citation delimiter only in prose and keeps its exact source identity", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    const marker = `[9](#citation-${id}]`
    const protectedText = `\`${marker}\`\n\n!${marker}`
    const text = `${marker}\n\n${protectedText}`
    const evidence = source(id, { citationRef: "e7" })
    const presentation = createCitationPresentation("answer", text, [evidence])
    expect(presentation.formatCitationGroups(text)).toBe(`${marker.slice(0, -1)})\n\n${protectedText}`)
    expect(presentation.resolveCitation(`#citation-${id}`)).toEqual({ answerId: "answer", number: 1, evidence })
    expect(createCitationPresentation("other-answer", text, []).missingReferences).toEqual([id])
  })

  it.each(malformedCitationFixtures)("normalizes the exact delimiter receipt $marker within its answer", (fixture) => {
    const presentation = createCitationPresentation(fixture.answerId, fixture.marker, [fixture.evidence])
    expect(presentation.formatCitationGroups(fixture.marker)).toBe(fixture.marker.slice(0, -1) + ")")
    expect(presentation.citations).toEqual([{ answerId: fixture.answerId, number: 1, evidence: fixture.evidence }])
  })

  it("exposes malformed missing and ambiguous IDs as unavailable without guessing another source", () => {
    const text = "[7](#citation-e549] [4](#citation-e139]"
    const presentation = createCitationPresentation("answer", text, [
      source("nearby", { citationRef: "e54" }),
      source("first-match", { citationRef: "e139" }),
      source("conflict", { citationRef: "e139" })
    ])
    expect(presentation.formatCitationGroups(text)).toBe("[7](#citation-e549) [4](#citation-e139)")
    expect(presentation.citations).toEqual([])
    expect(presentation.missingReferences).toEqual(["e549", "e139"])
  })

  it("normalizes malformed citations only in prose and preserves Markdown boundaries and literals", () => {
    const untouched = [
      "`[7](#citation-e549]`",
      "",
      "```md",
      "[7](#citation-e549]",
      "```",
      "",
      "    [7](#citation-e549]",
      "",
      "\\[7](#citation-e549]",
      "",
      "![7](#citation-e549]",
      "",
      "[outer [7](#citation-e549]](https://publisher.example/other)",
      "",
      '<div data-value="[7](#citation-e549]"></div>',
      "",
      "[7](#citation-e549suffix] [7](#citation-e0549] [7](#citation-e549"
    ].join("\n")
    const prose =
      "\n\n**Claim [7](#citation-e549]**\n\n| Claim | Source |\n| --- | --- |\n| Text | [7](#citation-e549] |"
    const presentation = createCitationPresentation("answer", untouched + prose, [
      source("exact", { citationRef: "e549" })
    ])
    expect(presentation.formatCitationGroups(untouched + prose)).toBe(
      untouched + prose.replaceAll("[7](#citation-e549]", "[7](#citation-e549)")
    )
    expect(presentation.citations).toHaveLength(1)
  })

  it("never carries a repaired marker's evidence across answers", () => {
    const text = "[7](#citation-e549]"
    const first = source("first", { citationRef: "e549" })
    const second = source("second", { citationRef: "e549" })
    expect(createCitationPresentation("first-answer", text, [first]).citations[0]?.evidence).toBe(first)
    expect(createCitationPresentation("second-answer", text, [second]).citations[0]?.evidence).toBe(second)
    expect(createCitationPresentation("missing-answer", text, []).missingReferences).toEqual(["e549"])
  })

  it.each([
    "[outer [7](#citation-e549]](https://publisher.example/other)",
    "![outer [7](#citation-e549]](https://publisher.example/image.png)",
    "[outer [7](#citation-e549]][ref]\n\n[ref]: https://publisher.example/other",
    "![outer [7](#citation-e549]][ref]\n\n[ref]: https://publisher.example/image.png"
  ])("preserves malformed markers inside surrounding Markdown labels: %s", (label) => {
    const text = `A claim [7](#citation-e549].\n\n${label}`
    const presentation = createCitationPresentation("answer", text, [source("exact", { citationRef: "e549" })])
    expect(presentation.formatCitationGroups(text)).toBe(`A claim [7](#citation-e549).\n\n${label}`)
    expect(presentation.citations).toHaveLength(1)
  })

  it("resolves short references to exact stable evidence and retains pending numbers", () => {
    const evidence = source("stable", { citationRef: "e1" })
    const text = "[9](#citation-e1) [2](#citation-unknown)"
    const pending = createCitationPresentation("answer", text, [])
    const complete = createCitationPresentation("answer", text, [evidence], pending.numbers)
    expect(complete.resolveCitation("#citation-e1")).toEqual({ answerId: "answer", number: 1, evidence })
    expect(complete.resolveReference("#citation-unknown")?.number).toBe(2)
    expect(complete.missingReferences).toEqual(["unknown"])
    expect(complete.formatCitationGroups("[9](#citation-e1) [1](#citation-stable)")).toBe("[1](#citation-stable)")
  })

  it("never resolves a conflicting short reference or carries evidence across answers", () => {
    const first = source("first", { citationRef: "e1" })
    const second = source("second", { citationRef: "e1" })
    const ambiguous = createCitationPresentation("answer", "[1](#citation-e1)", [first, second])
    expect(ambiguous.resolveCitation("#citation-e1")).toBeUndefined()
    expect(ambiguous.missingReferences).toEqual(["e1"])
    const another = createCitationPresentation("another", "[1](#citation-e1)", [second])
    expect(another.resolveCitation("#citation-e1")?.evidence.id).toBe("second")
  })

  it("leaves stale conversation references unresolved against a new turn's evidence", () => {
    const presentation = createCitationPresentation("next-answer", "[1](#citation-e1) [2](#citation-e8)", [
      source("current", { citationRef: "e8" })
    ])
    expect(presentation.resolveCitation("#citation-e1")).toBeUndefined()
    expect(presentation.resolveCitation("#citation-e8")?.evidence.id).toBe("current")
    expect(presentation.missingReferences).toEqual(["e1"])
  })

  it("numbers by citation order, ignoring model labels and consolidating repeated identities", () => {
    const first = source("first")
    const second = source("second")
    const presentation = createCitationPresentation(
      "answer",
      "[fabricated](#citation-unknown) [99](#citation-second) [1](#citation-first) [88](#citation-second)",
      [first, second, source("unused"), { ...second }]
    )
    expect(presentation.citations).toEqual([
      { answerId: "answer", number: 2, evidence: second },
      { answerId: "answer", number: 3, evidence: first }
    ])
    expect(presentation.resolveReference("#citation-unknown")).toEqual({
      answerId: "answer",
      number: 1,
      referenceId: "unknown",
      evidence: undefined
    })
    expect(presentation.resolveCitation("#citation-second")?.number).toBe(2)
    expect(presentation.resolveCitation("#citation-unknown")).toBeUndefined()
    expect(presentation.resolveCitation("#citation-unused")).toBeUndefined()
  })

  it("retains one number when missing evidence resolves and reuses missing references across claims", () => {
    const text = "[4](#citation-missing) [4](#citation-first). Another claim [9](#citation-missing)."
    const pending = createCitationPresentation("answer", text, [source("first")])
    expect(pending.references.map(({ number, referenceId }) => [number, referenceId])).toEqual([
      [1, "missing"],
      [2, "first"]
    ])
    expect(pending.missingReferences).toEqual(["missing"])
    const ready = createCitationPresentation("answer", text, [source("first"), source("missing")], pending.numbers)
    expect(ready.resolveCitation("#citation-missing")?.number).toBe(1)
    expect(ready.resolveCitation("#citation-first")?.number).toBe(2)
    expect(ready.missingReferences).toEqual([])
  })

  it("sorts and deduplicates citation groups without crossing claims or changing code and ordinary links", () => {
    const introduction = "[first](#citation-first), [missing](#citation-missing), [second](#citation-second).\n\n"
    const claim = "Claim [3](#citation-second)[2](#citation-missing), [1](#citation-first); [again](#citation-second)."
    const separate = "Different [3](#citation-second) and [1](#citation-first)."
    const untouched =
      "`[3](#citation-second) [1](#citation-first)` ![image](#citation-first) [link](https://unrelated.example)."
    const text = introduction + [claim, separate, untouched].join("\n\n")
    const presentation = createCitationPresentation("answer", text, [source("first"), source("second")])
    expect(presentation.formatCitationGroups(text)).toBe(
      "[first](#citation-first) [missing](#citation-missing) [second](#citation-second).\n\n" +
        ["Claim [1](#citation-first) [2](#citation-missing) [again](#citation-second).", separate, untouched].join(
          "\n\n"
        )
    )
  })

  it("consolidates unique URL aliases with explicit IDs and resolves reference links across prose segments", () => {
    const definitions = "[missing]: #citation-missing"
    const text = `[one](#citation-first) [two][missing].\n\n${definitions}`
    const presentation = createCitationPresentation("answer", text, [source("first")])
    expect(
      presentation.formatCitationGroups(
        `[2][missing] [9](https://publisher.example/first) [1](#citation-first)\n\n${definitions}`
      )
    ).toBe(`[1](#citation-first) [2][missing]\n\n${definitions}`)
  })

  it("uses Markdown syntax for references, nested labels, escaped links, code, images and GFM tables", () => {
    const first = source("first", { sourceUrl: "https://publisher.example/text/(2026)#section-2" })
    const second = source("second")
    const ignored = source("ignored")
    const text = [
      "[unused]: #citation-ignored",
      "",
      "`[code](#citation-ignored)`",
      "",
      "```md",
      "[fenced](#citation-ignored)",
      "```",
      "",
      "\\[escaped](#citation-ignored)",
      "",
      "![image](#citation-ignored)",
      "",
      '<a href="#citation-ignored">HTML</a>',
      "",
      "[A **nested** label][Ref] and [repeated](https://publisher.example/text/(2026)#section-2).",
      "",
      "| Claim | Evidence |",
      "| --- | --- |",
      "| Another | [Second][] |",
      "",
      "[REF]: #citation-first",
      "[Second]: #citation-second"
    ].join("\n")
    const presentation = createCitationPresentation("answer", text, [ignored, second, first])
    expect(presentation.citations.map((citation) => citation.evidence.id)).toEqual(["first", "second"])
    expect(presentation.resolveCitation(first.sourceUrl ?? undefined)?.number).toBe(1)
  })

  it("uses a unique provenance or readable URL alias without changing the evidence snapshot", () => {
    const evidence = source("first", {
      sourceUrl: "https://publisher.example/text.xml",
      readableUrl: "https://publisher.example/text.pdf"
    })
    const presentation = createCitationPresentation(
      "answer",
      "[9](https://PUBLISHER.example:443/text.pdf) [4](https://publisher.example/text.xml)",
      [evidence]
    )
    expect(presentation.citations).toEqual([{ answerId: "answer", number: 1, evidence }])
    expect(presentation.citations[0]?.evidence).toBe(evidence)
    expect(presentation.resolveCitation(evidence.sourceUrl ?? undefined)?.number).toBe(1)
    expect(presentation.resolveCitation(evidence.readableUrl ?? undefined)?.number).toBe(1)
  })

  it("does not select a passage from a URL shared by distinct evidence identities", () => {
    const shared = "https://publisher.example/bill"
    const first = source("section-1", { sourceUrl: shared })
    const second = source("section-2", { sourceUrl: shared })
    const third = source("revision-2", { readableUrl: shared })
    const presentation = createCitationPresentation(
      "answer",
      `[ambiguous](${shared}) [specific](#citation-section-2) [different](#citation-section-1)`,
      [first, second, third]
    )
    expect(presentation.resolveCitation(shared)).toBeUndefined()
    expect(presentation.citations.map(({ number, evidence }) => [number, evidence.id])).toEqual([
      [1, "section-2"],
      [2, "section-1"]
    ])
  })

  it("keeps URL-less evidence inspectable by ID and rejects unknown or unsafe destinations", () => {
    const evidence = source("offline", { sourceUrl: null })
    const presentation = createCitationPresentation(
      "answer",
      "[offline](#citation-offline) [foreign](#citation-foreign) [unsafe](javascript:alert(1))",
      [evidence]
    )
    expect(presentation.citations).toEqual([{ answerId: "answer", number: 1, evidence }])
    expect(presentation.resolveCitation("javascript:alert(1)")).toBeUndefined()
    expect(presentation.resolveCitation(undefined)).toBeUndefined()
  })

  it("retains assigned numbers across streamed additions and late reference definitions", () => {
    const evidence = [source("first"), source("second"), source("third")]
    const initial = createCitationPresentation("answer", "[later] [99](#citation-second)", evidence)
    const partial = createCitationPresentation(
      "answer",
      "[later] [99](#citation-second) [next](#citation-third",
      evidence,
      initial.numbers
    )
    expect(partial.citations.map(({ number }) => number)).toEqual([1])
    const complete = createCitationPresentation(
      "answer",
      "[later] [99](#citation-second) [next](#citation-third)\n\n[later]: #citation-first",
      evidence,
      partial.numbers
    )
    expect(complete.citations.map(({ number, evidence: cited }) => [number, cited.id])).toEqual([
      [1, "second"],
      [2, "first"],
      [3, "third"]
    ])
    const removed = createCitationPresentation("answer", "No citations remain.", evidence, complete.numbers)
    expect(removed.citations).toEqual([])
    expect(removed.resolveCitation("#citation-second")).toBeUndefined()
    const another = createCitationPresentation("another-answer", "[99](#citation-third)", evidence)
    expect(another.citations[0]?.number).toBe(1)
  })

  it("numbers used footnote citations after the answer body and excludes unused footnotes", () => {
    const evidence = [source("note"), source("body"), source("unused")]
    const text = [
      "[^note]: [support](#citation-note)",
      "[^unused]: [unused](#citation-unused)",
      "",
      "A statement[^note] and [body](#citation-body)."
    ].join("\n")
    const presentation = createCitationPresentation("answer", text, evidence)
    expect(presentation.citations.map((citation) => citation.evidence.id)).toEqual(["body", "note"])
  })
})
