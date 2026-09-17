import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { UIMessage } from "ai"
import { expect, fn, within } from "storybook/test"
import invariant from "tiny-invariant"
import { StickToBottom } from "use-stick-to-bottom"
import { ConversationResponse } from "../components/ConversationResponse"
import { recordMentionHref, type PresentationBlock } from "../composition"
import type { EvidenceSnapshot } from "../evidence"
import { activityPart, reviewData, toolCaptures } from "./reviewFixtures"

const read = toolCaptures.find((capture) => capture.toolName === "get_bill")
const search = toolCaptures.find((capture) => capture.toolName === "search_bills")
const empty = toolCaptures.find((capture) => capture.output.resultSet?.items.length === 0)
invariant(read && search && empty, "Missing conversation story captures")

const comparisonRead = reviewData.captures.find(
  (capture) => capture.toolName === "get_bill" && capture.input.id === "bill:ca:20232024:sb:1047"
)
const selected = read.output.resultSet?.items[0]
const compared = comparisonRead?.output.resultSet?.items[0]
const selectedResult = read.output.resultSet
const comparedResult = comparisonRead?.output.resultSet
invariant(
  selected && compared && selectedResult && comparedResult && comparisonRead,
  "Missing comparison bill captures"
)
const selectedReference = { resultId: selectedResult.id, recordId: selected.id }
const sources: EvidenceSnapshot[] = [selected, compared].map((record, index) => ({
  id: `review-bill-source-${index + 1}`,
  citationRef: `e${index + 1}`,
  title: record.title,
  origin: "canonical",
  sourceUrl: record.sourceUrl,
  content: { state: "not-collected" }
}))
const before = `For [AB 2652](${recordMentionHref(selectedReference)}), the latest recorded action is "${[selected.billSummary?.latestAction?.date, selected.billSummary?.latestAction?.description].filter(Boolean).join(": ")}" [1](#citation-e1)`
const after = `Its recorded status is ${selected.billSummary?.status}. [1](#citation-e1)`
const retrieved: UIMessage["parts"] = [
  activityPart(search, "Complete").part,
  { ...activityPart(read, "Complete").part, toolCallId: "read-selected" },
  { ...activityPart(comparisonRead, "Complete").part, toolCallId: "read-compared" }
]

function composedResponse(block?: Extract<PresentationBlock, { state: "ready" }>): UIMessage {
  const parts: UIMessage["parts"] = [...retrieved, { type: "text", text: before }]
  if (block) {
    parts.push({ type: "data-presentation", id: block.blockId, data: block })
  }
  parts.push({ type: "text", text: after })
  return { id: "composed-answer", role: "assistant", parts }
}

const selectedCard: Extract<PresentationBlock, { state: "ready" }> = {
  state: "ready",
  blockId: "selected-bill",
  records: [selected],
  spec: { root: "record", elements: { record: { type: "RecordCard", props: selectedReference, children: [] } } }
}
const billList: Extract<PresentationBlock, { state: "ready" }> = {
  state: "ready",
  blockId: "selected-bills",
  records: [],
  content: { id: "33333333-3333-4333-8333-333333333333", kind: "result-list", page: selectedResult },
  spec: {
    root: "bills",
    elements: {
      bills: {
        type: "ResultList",
        props: { contentId: "33333333-3333-4333-8333-333333333333" },
        children: []
      }
    }
  }
}

const meta: Meta<typeof ConversationResponse> = {
  title: "Conversation/ConversationResponse",
  component: ConversationResponse,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <StickToBottom initial={false} resize="instant">
        <Story />
      </StickToBottom>
    )
  ],
  args: {
    message: { id: "review-response", role: "assistant", parts: [activityPart(read, "Complete").part] },
    isRunning: false,
    isIncomplete: false,
    evidence: [],
    onEvidence: fn()
  }
}
export default meta
type Story = StoryObj<typeof meta>

export const CompleteCollapsed: Story = {}
export const CompleteExpanded: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const trigger = within(canvasElement).getByRole("button", { name: /Research activity/ })
    if (trigger.getAttribute("aria-expanded") !== "true") {
      await userEvent.click(trigger)
    }
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
  }
}
export const MixedOutcomes: Story = {
  args: {
    message: {
      id: "mixed",
      role: "assistant",
      parts: [activityPart(search, "Complete").part, activityPart(read, "Failed").part]
    }
  },
  play: async (context) => {
    await CompleteExpanded.play?.(context)
    const canvas = within(context.canvasElement)
    await expect(canvas.getByRole("button", { name: "Research activity 2 steps" })).toBeVisible()
    await expect(canvas.getByLabelText("Search bills: Complete")).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Read bill: Failed" })).toHaveAttribute("aria-expanded", "false")
  }
}
export const MixedOutcomesExpanded: Story = {
  args: MixedOutcomes.args,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const activity = canvas.getByRole("button", { name: /Research activity/ })
    if (activity.getAttribute("aria-expanded") !== "true") {
      await userEvent.click(activity)
    }
    await expect(activity).toHaveAccessibleName("Research activity 2 steps")
    const failure = canvas.getByRole("button", { name: /: Failed$/ })
    if (failure.getAttribute("aria-expanded") !== "true") {
      await userEvent.click(failure)
    }
    await expect(failure).toHaveAttribute("aria-expanded", "true")
    await expect(canvas.getByLabelText("Search bills: Complete")).toBeVisible()
    await expect(canvas.getByText(/The data service is temporarily unavailable/)).toBeVisible()
    await expect(canvas.getByText("Failed")).toBeVisible()
  }
}
export const ActiveRequest: Story = {
  args: {
    isRunning: true,
    message: {
      id: "active",
      role: "assistant",
      parts: [activityPart(search, "Complete").part, activityPart(read, "Running").part]
    }
  }
}
export const InterruptedRequest: Story = {
  args: {
    isIncomplete: true,
    message: { id: "interrupted", role: "assistant", parts: [activityPart(read, "Interrupted request").part] }
  }
}
export const DeniedRequest: Story = {
  args: { message: { id: "denied", role: "assistant", parts: [activityPart(read, "Denied").part] } },
  play: CompleteExpanded.play
}
export const FailedRequest: Story = {
  args: { message: { id: "failed", role: "assistant", parts: [activityPart(read, "Failed", "internal").part] } },
  play: async (context) => {
    await CompleteExpanded.play?.(context)
    const canvas = within(context.canvasElement)
    const failure = canvas.getByRole("button", { name: "Read bill: Failed" })
    if (failure.getAttribute("aria-expanded") !== "true") {
      await context.userEvent.click(failure)
    }
    await expect(
      canvas.getByText("This research operation failed. Reference: storybook-simulated-failure")
    ).toBeVisible()
    await expect(canvas.queryByText(/Try again/i)).not.toBeInTheDocument()
  }
}
export const NoTools: Story = {
  args: { message: { id: "no-tools", role: "assistant", parts: [] } }
}
export const NoMatches: Story = {
  args: { message: { id: "no-matches", role: "assistant", parts: [activityPart(empty, "Complete").part] } }
}

export const InlineMention: Story = {
  args: { message: composedResponse(), evidence: sources },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("link", { name: "AB 2652" })).toHaveAttribute("href", selected.sourceUrl)
    await expect(canvas.queryByRole("region", { name: /^Bill:/ })).not.toBeInTheDocument()
    const disclosure = canvas.getByRole("button", { name: "Sources 1" })
    if (disclosure.getAttribute("aria-expanded") !== "true") {
      await userEvent.click(disclosure)
    }
    await expect(
      within(canvas.getByRole("region", { name: "Sources" })).getAllByRole("button", { name: /^Read source/ })
    ).toHaveLength(1)
    await expect(canvas.queryByText(compared.title)).not.toBeInTheDocument()
  }
}

export const SelectedCard: Story = {
  args: { message: composedResponse(selectedCard), evidence: sources },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const card = canvas.getByRole("region", { name: `Bill: ${selected.title}` })
    await expect(card).toBeVisible()
    await expect(canvas.getAllByRole("region", { name: /^Bill:/ })).toHaveLength(1)
    await expect(canvas.queryByText(compared.title)).not.toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: "Sources 1" })).toBeVisible()
  }
}

export const CompactBillList: Story = {
  args: { message: composedResponse(billList), evidence: sources },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("region", { name: "Bills" })).toBeVisible()
    await expect(canvas.queryByRole("table")).not.toBeInTheDocument()
    await expect(canvas.queryByRole("region", { name: /^Bill:/ })).not.toBeInTheDocument()
    await expect(canvas.getByRole("button", { name: "Sources 1" })).toBeVisible()
  }
}

export const ProseOnly: Story = {
  args: {
    message: {
      id: "prose-only",
      role: "assistant",
      parts: [
        {
          type: "text",
          text: "A bill is a proposal considered by a legislative body. It is not necessarily an enacted law."
        }
      ]
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole("region", { name: "Sources" })).not.toBeInTheDocument()
    await expect(canvas.queryByRole("table")).not.toBeInTheDocument()
    await expect(canvas.queryByRole("region", { name: /^Bill:/ })).not.toBeInTheDocument()
  }
}
