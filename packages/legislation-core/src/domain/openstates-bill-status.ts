const lifecycleLabels = {
  "became-law": "Became law",
  "executive-veto-line-item": "Line-item veto",
  "executive-veto": "Vetoed",
  "executive-signature": "Signed by executive",
  "veto-override-passage": "Veto override passed",
  "veto-override-failure": "Veto override failed",
  "executive-receipt": "Received by executive",
  enrolled: "Enrolled",
  withdrawal: "Withdrawn",
  failure: "Passage failed",
  passage: "Passed",
  "committee-failure": "Failed in committee",
  "committee-passage-unfavorable": "Reported unfavorably by committee",
  "committee-passage-favorable": "Reported favorably by committee",
  "committee-passage": "Passed committee",
  "referral-committee": "Referred to committee",
  referral: "Referred",
  deferral: "Deferred",
  "reading-3": "Third reading",
  "reading-2": "Second reading",
  "reading-1": "First reading",
  introduction: "Introduced",
  filing: "Filed",
  receipt: "Received"
}

export const openStatesStatusClassifications = Object.keys(lifecycleLabels)

type StatusAction = { ordinal: number; classification?: string[] | null; chamber?: string | null }

export function openStatesBillStatus(actions: readonly StatusAction[]) {
  for (const action of actions.toSorted((left, right) => right.ordinal - left.ordinal)) {
    const matched = Object.entries(lifecycleLabels).find(([classification]) =>
      action.classification?.includes(classification)
    )
    if (!matched) {
      continue
    }
    const [classification, label] = matched
    if (["passage", "failure", "veto-override-passage", "veto-override-failure"].includes(classification)) {
      if (action.chamber === "lower" || action.chamber === "upper") {
        return `${label} in ${action.chamber} chamber`
      }
      return `${label} in chamber`
    }
    return label
  }
  return undefined
}
