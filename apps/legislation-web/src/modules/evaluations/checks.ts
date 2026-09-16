import { z } from "zod"
import { evidenceSnapshotSchema } from "../conversations/evidence"
import type { EvalCase, EvalEvent, EvalScore, EvalTurn } from "./contracts"

const evidenceOutput = z.object({ evidence: z.array(evidenceSnapshotSchema) })

export function checkRun(item: EvalCase, turns: EvalTurn[], events: EvalEvent[]): EvalScore[] {
  const scores: EvalScore[] = []
  let invalidAnchors = 0
  let anchorCount = 0
  let numberingErrors = 0
  for (const [turnIndex, turn] of turns.entries()) {
    const evidence = events
      .filter((event) => event.turn === turnIndex && event.type === "result")
      .flatMap((event) => {
        const parsed = evidenceOutput.safeParse(event.value)
        return parsed.success ? parsed.data.evidence : []
      })
    const numbers = new Map<string, string>()
    for (const citation of turn.text.matchAll(/\[(\d+)\]\((#[^\s)]+)\)/g)) {
      const [, number, href] = citation
      if (!href || !number) {
        continue
      }
      const id = href.slice("#citation-".length)
      anchorCount++
      if (!href.startsWith("#citation-") || !evidence.some((snapshot) => snapshot.id === id)) {
        invalidAnchors++
      }
      const previous = numbers.get(id)
      if (previous ? previous !== number : Number(number) !== numbers.size + 1) {
        numberingErrors++
      }
      numbers.set(id, number)
    }
  }
  scores.push({
    name: "citation-validity",
    value: anchorCount ? Number(invalidAnchors === 0) : null,
    detail: `${invalidAnchors} invalid of ${anchorCount}; structural validity only.`
  })
  scores.push({
    name: "citation-numbering",
    value: anchorCount ? Number(numberingErrors === 0) : null,
    detail: `${numberingErrors} numbering errors.`
  })
  scores.push({
    name: "required-citation",
    value: item.expected.requiresCitation ? Number(anchorCount > invalidAnchors) : null,
    detail: "Case-level citation requirement; entailment needs semantic review."
  })
  const calls = events.filter((event) => event.type === "call")
  const clarificationCalls = calls.filter((event) => event.tool === "ask_clarification")
  const parallelClarification = clarificationCalls.some((question) =>
    calls.some(
      (event) => event.turn === question.turn && event.step === question.step && event.callId !== question.callId
    )
  )
  scores.push({
    name: "clarification-isolation",
    value: Number(!parallelClarification),
    detail: "Clarification must be the only tool call in its model step."
  })
  scores.push({
    name: "no-unnecessary-research",
    value: item.expected.noResearch ? Number(calls.every((event) => event.tool === "ask_clarification")) : null,
    detail: "Research-free case contract."
  })
  const finalTurn = turns.at(-1)
  scores.push({
    name: "terminal-contract",
    value: Number(
      item.expected.terminal === "clarification"
        ? finalTurn?.termination === "clarification"
        : finalTurn?.termination === "stop" && Boolean(finalTurn.text.trim())
    ),
    detail: `Expected ${item.expected.terminal}; received ${finalTurn?.termination ?? "no turn"}.`
  })
  const text = turns
    .map((turn) => turn.text)
    .join("\n")
    .toLowerCase()
  for (const [index, required] of item.expected.requiredText.entries()) {
    scores.push({
      name: `required-text-${index + 1}`,
      value: Number(text.includes(required.toLowerCase())),
      detail: required
    })
  }
  for (const [index, forbidden] of item.expected.forbiddenText.entries()) {
    scores.push({
      name: `forbidden-text-${index + 1}`,
      value: Number(!text.includes(forbidden.toLowerCase())),
      detail: forbidden
    })
  }
  return scores
}
