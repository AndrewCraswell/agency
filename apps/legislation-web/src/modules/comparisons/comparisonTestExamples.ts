import { compareDocuments } from "@repo/legislation-diffing/comparison"

// Small synthetic inputs are confined to component behavior tests.
function example(name: string, left: string, right: string) {
  return {
    state: {
      status: "ready" as const,
      comparison: compareDocuments({
        left: { id: `test:${name}:left`, contentHash: "a".repeat(64), text: left },
        right: { id: `test:${name}:right`, contentHash: "b".repeat(64), text: right },
        granularity: "word"
      })
    },
    leftDisplayLabel: `${name}: earlier text`,
    rightDisplayLabel: `${name}: later text`
  }
}

export const stateWordingExample = example(
  "state-reporting",
  "REPORTING REQUIREMENTS\n\nThe department shall publish a report within 30 days.\n\nRecords remain public.",
  "REPORTING REQUIREMENTS\n\nThe department may publish a report within 45 days.\n\nRecords remain public."
)
export const chapterCollisionExample = example(
  "chapter-reference",
  "Chapter 53\nOwnership reporting remains required.",
  "Chapter 53\nWhistleblower reports remain protected."
)
export const unchangedExample = example(
  "identical",
  "Retained text.\n\nSecond paragraph.",
  "Retained text.\n\nSecond paragraph."
)
export const pendingDocuments = {
  left: stateWordingExample.state.comparison.left,
  right: stateWordingExample.state.comparison.right
}
