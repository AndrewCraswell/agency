import { z } from "zod"
import { canonicalJson, digest, type EvalCase } from "./contracts"
import type { CaseResult } from "./runner"

export const evaluationInputContract = "deduplicated-reference-evidence"

export function buildEvaluationInput(item: EvalCase, result: CaseResult) {
  let reference = item.reference
  const referenceEvidence: { turn: number; callId: string; dataHash: string }[] = []
  for (const event of result.events) {
    if (event.type !== "result") {
      continue
    }
    const parsed = z.object({ data: z.json() }).safeParse(event.value)
    if (!parsed.success) {
      continue
    }
    const serialized = JSON.stringify(parsed.data.data)
    if (serialized.length < 100 || !reference.includes(serialized)) {
      continue
    }
    const dataHash = digest(parsed.data.data)
    reference = reference.replaceAll(
      serialized,
      `[Exact reference data: successful tool result ${event.callId}, turn ${event.turn}, SHA-256 ${dataHash}. Read its complete data in events.]`
    )
    referenceEvidence.push({ turn: event.turn, callId: event.callId, dataHash })
  }
  const input = {
    inputContract: evaluationInputContract,
    request: item.messages,
    followUps: item.followUps,
    reference,
    referenceEvidence,
    expected: item.expected,
    turns: result.turns.map((turn) => ({ text: turn.text, termination: turn.termination })),
    events: result.events
  }
  return { input, inputHash: digest(input), inputCharacters: canonicalJson(input).length }
}
