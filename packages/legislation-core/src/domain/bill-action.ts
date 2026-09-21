type FederalActionInput = Readonly<{
  actionCode?: string
  sourceSystem?: string
  text: string
  type?: string
}>

export const billProgressClassifications = [
  "introduction",
  "referral-committee",
  "committee-passage",
  "committee-passage-favorable",
  "committee-passage-unfavorable",
  "passage",
  "executive-receipt",
  "executive-signature",
  "executive-veto",
  "became-law"
]

export function normalizeFederalAction(input: FederalActionInput) {
  const text = input.text.trim()
  const classification: string[] = []
  let chamber: "lower" | "upper" | undefined
  const passage =
    /^(?:Passed\/agreed to in (House|Senate):\s*)?(?:Passed (?:the )?(House|Senate)\b|On passage\s+Passed\b)/i.exec(
      text
    )
  const concurrence =
    /^(?:Resolving differences\s*--\s*(?:House|Senate) actions:\s*)?(House|Senate) agreed to (?:the )?(?:House|Senate) amendments?\b/i.exec(
      text
    )
  const introduction = /^introduced in (?:the )?(house|senate)\b/i.exec(text)
  if (introduction || /^intro(?:duced|duction)$/i.test(input.type ?? "")) classification.push("introduction")
  if (/^referred to\b.*\bcommittee\b/i.test(text)) classification.push("referral-committee")
  if (/\b(?:ordered to be reported|reported favorably|reported with(?:out)? recommendation)\b/i.test(text)) {
    classification.push("committee-passage-favorable")
  } else if (/\breported unfavorably\b/i.test(text)) {
    classification.push("committee-passage-unfavorable")
  } else if (/^committee\b.*\b(?:reported|passed|approved)\b/i.test(text)) {
    classification.push("committee-passage")
  }
  if (passage || concurrence || /^passage$/i.test(input.type ?? "")) classification.push("passage")
  const actingChamber = passage?.[1] ?? passage?.[2] ?? concurrence?.[1] ?? introduction?.[1]
  const source = actingChamber ?? input.sourceSystem ?? ""
  if (/\bhouse\b/i.test(source)) chamber = "lower"
  else if (/\bsenate\b/i.test(source)) chamber = "upper"
  else if (/^referred to (?:the )?house\b/i.test(text)) chamber = "lower"
  else if (/^referred to (?:the )?senate\b/i.test(text)) chamber = "upper"
  if (/^(?:presented|sent|transmitted) to (?:the )?president\b/i.test(text)) classification.push("executive-receipt")
  if (/^signed by (?:the )?president\b/i.test(text)) classification.push("executive-signature")
  if (/^(?:became|is) (?:public |private )?law\b/i.test(text)) classification.push("became-law")
  if (/^(?:vetoed by (?:the )?president|pocket veto)/i.test(text)) classification.push("executive-veto")
  if (/\benrolled\b/i.test(text)) classification.push("enrolled")
  return { chamber, classification }
}

export function normalizeBillAction<
  Action extends {
    classification: string[]
    chamber?: string | null
    description?: string | null
  }
>(action: Action, jurisdictionId: string | undefined) {
  const inferred =
    jurisdictionId === "jurisdiction:us"
      ? normalizeFederalAction({ text: action.description ?? "" })
      : { classification: [], chamber: undefined }
  return {
    ...action,
    classification: action.classification.length > 0 ? action.classification : inferred.classification,
    chamber: action.chamber ?? inferred.chamber ?? null
  }
}

export function hasTerminalBillStatus(status: string | null | undefined) {
  return /^(?:enacted|signed|vetoed|became[- ]law|became (?:public |private )?law)(?:\b|$)/i.test(status ?? "")
}
