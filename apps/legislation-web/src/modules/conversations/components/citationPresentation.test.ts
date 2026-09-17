import { describe, expect, it } from "vitest"
import type { EvidenceSnapshot } from "../evidence"
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
