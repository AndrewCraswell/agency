import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useRef, useState } from "react"
import { expect, waitFor, within } from "storybook/test"
import invariant from "tiny-invariant"
import { StickToBottom } from "use-stick-to-bottom"
import { projectBillProgress } from "../billProgress"
import { markdownEvidenceFixture, qualifiedEvidenceFixture } from "../components/citationEvidenceFixtures"
import type { CitationSelection } from "../components/citationPresentation"
import { ComposedRecord } from "../components/ComposedRecord"
import { ConversationResponse } from "../components/ConversationResponse"
import { EvidencePanel } from "../components/EvidencePanel"
import { presentationBlockSchema } from "../composition"
import { projectEntityResult, type EntityPage } from "../entityResults"
import { projectPresentationContents, type ContentComponent, type PresentationContent } from "../presentationContent"
import { drawerEvidence } from "./drawerExamples"
import { toolCaptures } from "./reviewFixtures"
import * as billProgressStyles from "../components/BillProgressCard.css"

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

function billProgressExample(mode: "enacted" | "committee" | "gap") {
  const bill = {
    id: "bill:us:114:hr:636",
    identifier: "HR 636",
    title: "FAA Extension, Safety, and Security Act of 2016",
    chamber: "lower",
    jurisdictionId: "jurisdiction:us",
    sessionName: "114th Congress",
    status: mode === "committee" ? "Referred to committee" : "Became Public Law No: 114-190.",
    sourceUrl: "https://www.congress.gov/bill/114th-congress/house-bill/636"
  }
  const descriptions = [
    ["2015-02-02", "Introduced in House"],
    ["2015-02-02", "Referred to the Committee on Ways and Means"],
    ["2015-02-13", "Passed/agreed to in House: On passage Passed by recorded vote: 272 - 142."],
    ["2016-04-19", "Passed Senate with an amendment by Yea-Nay Vote."],
    ["2016-07-15", "Became Public Law No: 114-190."]
  ]
  const data = {
    bill,
    progressTruncated: false,
    progressActions: descriptions.flatMap(([actionDate, description], ordinal) => {
      if ((mode === "committee" && ordinal > 1) || (mode === "gap" && ordinal === 2)) {
        return []
      }
      return [
        {
          id: `action-${ordinal}`,
          billId: bill.id,
          ordinal,
          actionDate,
          description,
          classification: [],
          chamber: null
        }
      ]
    })
  }
  const projection = projectEntityResult("get_bill", data)
  invariant(projection)
  const page: EntityPage = {
    ...projection,
    id: "11111111-1111-4111-8111-111111111111",
    page: 0,
    start: 1,
    end: 1,
    hasNext: false,
    hasPrevious: false
  }
  const progress = projectBillProgress(data, page)
  invariant(progress)
  return progress
}

export const EnactedBillProgress: Story = {
  render: () => display(billProgressExample("enacted"), "BillProgressCard"),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("region", { name: "Bill milestones" })).toBeVisible()
    await expect(canvas.queryByText("Not recorded")).not.toBeInTheDocument()
    await expect(canvasElement.querySelector('[aria-current="step"]')).not.toBeInTheDocument()
    await expect(canvasElement.querySelector('time[datetime="2016-07-15"]')).toBeVisible()
    const tracks = canvasElement.querySelectorAll(`.${billProgressStyles.track}`)
    const primary = getComputedStyle(canvasElement.querySelector(`.${billProgressStyles.dot}`)!).backgroundColor
    for (const track of [...tracks].slice(0, -1)) {
      await expect(getComputedStyle(track, "::before").backgroundColor).toBe(primary)
      await expect(parseFloat(getComputedStyle(track, "::before").width)).toBeCloseTo(
        track.getBoundingClientRect().width,
        0
      )
    }
  }
}
export const CommitteeBillProgress: Story = {
  render: () => display(billProgressExample("committee"), "BillProgressCard"),
  play: async ({ canvasElement }) => {
    const tracks = canvasElement.querySelectorAll(`.${billProgressStyles.track}`)
    const first = tracks[0]
    const second = tracks[1]
    invariant(first && second)
    const primary = getComputedStyle(canvasElement.querySelector(`.${billProgressStyles.dot}`)!).backgroundColor
    await expect(getComputedStyle(first, "::before").backgroundColor).toBe(primary)
    await expect(getComputedStyle(second, "::before").backgroundColor).not.toBe(primary)
    await expect(canvasElement.querySelector('[aria-current="step"]')).toHaveTextContent("Committee")
  }
}
export const GappedBillProgress: Story = {
  render: () => display(billProgressExample("gap"), "BillProgressCard"),
  play: async ({ canvasElement }) => {
    const tracks = [...canvasElement.querySelectorAll(`.${billProgressStyles.track}`)]
    const primary = getComputedStyle(canvasElement.querySelector(`.${billProgressStyles.dot}`)!).backgroundColor
    for (const index of [1, 2]) {
      invariant(tracks[index])
      await expect(getComputedStyle(tracks[index], "::before").backgroundColor).not.toBe(primary)
    }
  }
}
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
