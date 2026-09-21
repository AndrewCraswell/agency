type FederalActionInput = Readonly<{
  actionCode?: string
  sourceSystem?: string
  text: string
  type?: string
}>

const LOWER_CHAMBER_PATTERN = /\b(?:house|h\.?\s*)\b/i
const UPPER_CHAMBER_PATTERN = /\b(?:senate|s\.?\s*)\b/i

function actionChamber(input: FederalActionInput): "lower" | "upper" | undefined {
  const context = `${input.sourceSystem ?? ""} ${input.type ?? ""} ${input.actionCode ?? ""} ${input.text}`
  if (LOWER_CHAMBER_PATTERN.test(context)) {
    return "lower"
  }
  if (UPPER_CHAMBER_PATTERN.test(context)) {
    return "upper"
  }
  return undefined
}

export function normalizeFederalAction(input: FederalActionInput) {
  const context = `${input.actionCode ?? ""} ${input.type ?? ""} ${input.text}`.trim()
  const classifications: string[] = []

  if (/^introduced in (?:the )?(?:house|senate)\b/i.test(input.text) || /\bintro(?:duced|duction)\b/i.test(context)) {
    classifications.push("introduction")
  }
  if (/\breferred to\b.*\bcommittee\b/i.test(input.text)) {
    classifications.push("referral-committee")
  }
  if (/\b(?:ordered to be reported|reported favorably|reported with(?:out)? recommendation)\b/i.test(input.text)) {
    classifications.push("committee-passage-favorable")
  } else if (/\breported unfavorably\b/i.test(input.text)) {
    classifications.push("committee-passage-unfavorable")
  } else if (/\bcommittee\b.*\b(?:reported|passed|approved)\b/i.test(input.text)) {
    classifications.push("committee-passage")
  }
  if (
    /\b(?:passed (?:the )?(?:house|senate)|(?:house|senate) (?:passed|agreed to)|agreed to in (?:the )?(?:house|senate))\b/i.test(
      input.text
    ) ||
    /\bon passage passed\b/i.test(input.text) ||
    /^passage$/i.test(input.type ?? "") ||
    /\b(?:h|s)\d*[a-z]*pass\b/i.test(input.actionCode ?? "")
  ) {
    classifications.push("passage")
  }
  if (/\b(?:presented|sent|transmitted) to (?:the )?president\b/i.test(input.text)) {
    classifications.push("executive-receipt")
  }
  if (/\bsigned by (?:the )?president\b/i.test(input.text)) {
    classifications.push("executive-signature")
  }
  if (/\b(?:became|is) (?:public|private )?law\b|\bpublic law no\b/i.test(input.text)) {
    classifications.push("became-law")
  }
  if (/\b(?:vetoed|pocket veto)\b/i.test(input.text)) {
    classifications.push("executive-veto")
  }
  if (/\benrolled\b/i.test(input.text)) {
    classifications.push("enrolled")
  }

  return {
    chamber: actionChamber(input),
    classification: [...new Set(classifications)]
  }
}
