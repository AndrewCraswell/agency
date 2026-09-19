import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useRef, useState } from "react"
import { expect, waitFor, within } from "storybook/test"
import invariant from "tiny-invariant"
import { StickToBottom } from "use-stick-to-bottom"
import { markdownEvidenceFixture, qualifiedEvidenceFixture } from "../components/citationEvidenceFixtures"
import type { CitationSelection } from "../components/citationPresentation"
import { ComposedRecord } from "../components/ComposedRecord"
import { ConversationResponse } from "../components/ConversationResponse"
import { EvidencePanel } from "../components/EvidencePanel"
import { presentationBlockSchema } from "../composition"
import { projectPresentationContents, type ContentComponent, type PresentationContent } from "../presentationContent"
import { drawerEvidence } from "./drawerExamples"
import { toolCaptures } from "./reviewFixtures"

const meta = {
  title: "Conversation/InlinePresentation",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <StickToBottom initial={false} resize="instant">
        <Story />
      </StickToBottom>
    )
  ]
} satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
const source: PresentationContent = {
  id: "33333333-3333-4333-8333-333333333333",
  kind: "evidence",
  evidence: { ...drawerEvidence, citationRef: "e1" }
}
function display(content: PresentationContent, component: ContentComponent) {
  return <InlineExample content={content} component={component} />
}
function InlineExample({
  content,
  component
}: Readonly<{ content: PresentationContent; component: ContentComponent }>) {
  const [citation, setCitation] = useState<CitationSelection>()
  const trigger = useRef<HTMLElement | null>(null)
  const block = presentationBlockSchema.parse({
    state: "ready",
    blockId: "selected-content",
    records: [],
    content,
    spec: {
      root: "content",
      elements: { content: { type: component, props: { contentId: content.id }, children: [] } }
    }
  })
  return (
    <>
      <ConversationResponse
        message={{
          id: "inline-review",
          role: "assistant",
          parts: [{ type: "data-presentation", id: block.blockId, data: block }]
        }}
        isRunning={false}
        isIncomplete={false}
        onEvidence={(selection) => {
          trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          setCitation(selection)
        }}
      />
      <EvidencePanel
        selection={citation}
        onClose={() => setCitation(undefined)}
        returnFocus={() => trigger.current?.focus()}
      />
    </>
  )
}
function captured(toolName: string, kind: PresentationContent["kind"]) {
  const capture = toolCaptures.find((capture) => capture.toolName === toolName)
  invariant(capture, `Missing ${toolName} capture`)
  const content = projectPresentationContents(toolName, capture.output.data, [], capture.output.resultSet).find(
    (content) => content.kind === kind
  )
  invariant(content, `Missing ${kind} projection`)
  return content
}
export const CitationCard: Story = {
  render: () => display(source, "CitationCard"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("region", { name: `Citation: ${drawerEvidence.title}` })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Copy citation" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Sources 1" })).toBeVisible()
  }
}
export const PassageQuote: Story = { render: () => display(source, "PassageQuote") }
export const CompactPassage: Story = {
  render: () => display(source, "CompactPassageCard"),
  play: async ({ canvasElement, userEvent }) => {
    delete canvasElement.dataset.compactPassageChecked
    const canvas = within(canvasElement)
    await expect(canvasElement.querySelector("blockquote")).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole("button", { name: `Read source 1: ${drawerEvidence.title}` }))
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole("dialog", { name: "Source 1" })).toBeVisible()
    await userEvent.click(body.getByRole("button", { name: "Close evidence" }))
    await waitFor(() =>
      expect(body.queryByRole("dialog", { name: "Source 1" })?.getAttribute("data-state")).not.toBe("open")
    )
    canvasElement.dataset.compactPassageChecked = "true"
  }
}
export const TruncatedPassage: Story = {
  render: () => display(source, "PassageQuote"),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const expand = canvas.getByRole("button", { name: "Show full passage" })
    await userEvent.click(expand)
    await expect(canvasElement.querySelector("blockquote")?.textContent?.replace(/\s+/g, " ").trim()).toBe(
      drawerEvidence.content.state === "available" ? drawerEvidence.content.quote.replace(/\s+/g, " ").trim() : ""
    )
    await userEvent.click(canvas.getByRole("button", { name: "Show less" }))
  }
}
export const MarkdownTablePassage: Story = {
  render: () => display({ ...source, evidence: markdownEvidenceFixture }, "PassageQuote"),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const preview = canvas.getByRole("region", { name: "Retrieved passage" })
    await expect(within(preview).getByRole("heading", { name: "Budget estimate" })).toBeVisible()
    await expect(within(preview).getByRole("cell", { name: "$17 million" })).toBeInTheDocument()
    const expand = canvas.getByRole("button", { name: "Show retrieved excerpt" })
    expand.focus()
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByRole("button", { name: "Show less" })).toHaveAttribute("aria-expanded", "true")
    await expect(canvas.getByText(/illustrative components must not/)).toBeVisible()
    await expect(canvas.getByText("Only part of the retrieved passage is shown.")).toBeVisible()
  }
}
export const QualifiedStudyPassage: Story = {
  render: () => display({ ...source, evidence: qualifiedEvidenceFixture }, "PassageQuote"),
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const expand = canvas.getByRole("button", { name: "Show retrieved excerpt" })
    expand.focus()
    await userEvent.keyboard(" ")
    await expect(canvas.getByText(/carefully designed safeguards/)).toBeVisible()
    await expect(canvas.getByText(/does not establish results for all US districts/)).toBeVisible()
    await expect(canvas.getByRole("link", { name: "Read in full" })).toHaveAttribute(
      "href",
      qualifiedEvidenceFixture.sourceUrl
    )
  }
}
export const PassageUnavailable: Story = {
  render: () =>
    display(
      {
        ...source,
        evidence: { ...source.evidence, sourceUrl: null, readableUrl: undefined, content: { state: "unavailable" } }
      },
      "CitationCard"
    )
}
export const PassageNotCollected: Story = {
  render: () =>
    display({ ...source, evidence: { ...source.evidence, content: { state: "not-collected" } } }, "PassageQuote")
}
export const PassageFailed: Story = {
  render: () => display({ ...source, evidence: { ...source.evidence, content: { state: "failed" } } }, "CitationCard")
}
export const Loading: Story = {
  render: () => (
    <ComposedRecord
      isRunning
      part={{ type: "data-presentation", id: "pending", data: { state: "pending", blockId: "pending" } }}
    />
  )
}
export const ResultList: Story = { render: () => display(captured("search_bills", "result-list"), "ResultList") }
export const ProgressPath: Story = { render: () => display(captured("get_bill_timeline", "timeline"), "ProgressPath") }
export const RecordTimeline: Story = {
  render: () => display(captured("get_bill_timeline", "timeline"), "RecordTimeline")
}
export const RollCall: Story = { render: () => display(captured("get_vote", "roll-call"), "RollCall") }
export const NotFound: Story = {
  render: () =>
    display(
      {
        id: source.id,
        kind: "record-status",
        recordId: "not-found-review",
        title: "Requested record",
        state: "not-found",
        sourceUrl: null
      },
      "RecordStatus"
    )
}
export const NotCollected: Story = {
  render: () =>
    display(
      {
        id: source.id,
        kind: "record-status",
        recordId: drawerEvidence.recordId ?? drawerEvidence.id,
        title: drawerEvidence.title,
        state: "not-collected",
        sourceUrl: drawerEvidence.sourceUrl
      },
      "RecordStatus"
    )
}
