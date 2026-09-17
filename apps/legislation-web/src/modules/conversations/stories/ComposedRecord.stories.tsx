import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"
import invariant from "tiny-invariant"
import { StickToBottom } from "use-stick-to-bottom"
import { ComposedRecord } from "../components/ComposedRecord"
import { presentationBlockSchema } from "../composition"
import type { EntityKind } from "../entityResults"
import { projectPresentationContents } from "../presentationContent"
import { capturedCards, toolCaptures } from "./reviewFixtures"
import * as compactStyles from "../components/CompactRecordCard.css"
import * as styles from "./ReviewGallery.css"

type RecordArgs = { kind: EntityKind }
const meta = {
  title: "Conversation/ComposedRecord",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <StickToBottom initial={false} resize="instant">
        <Story />
      </StickToBottom>
    )
  ],
  args: { kind: "bill" },
  argTypes: { kind: { control: false } },
  render: ({ kind }) => {
    const captures = capturedCards.filter(({ record }) => record.kind === kind)
    invariant(captures.length, `Missing ${kind} captures`)
    return (
      <div className={styles.grid}>
        {captures.map(({ record, resultId, toolName }) => (
          <section key={record.id} className={styles.sample} aria-label={record.id} data-review-record={record.id}>
            <p className={styles.metadata}>
              {toolName} / {record.id}
            </p>
            <ComposedRecord
              isRunning={false}
              part={{
                type: "data-presentation",
                id: record.id,
                data: {
                  state: "ready",
                  blockId: record.id,
                  records: [record],
                  spec: {
                    root: "record",
                    elements: { record: { type: "RecordCard", props: { resultId, recordId: record.id }, children: [] } }
                  }
                }
              }}
            />
          </section>
        ))}
      </div>
    )
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    for (const { record } of capturedCards.filter(({ record }) => record.kind === args.kind)) {
      await expect(canvas.getByRole("region", { name: record.id })).toBeVisible()
    }
  }
} satisfies Meta<RecordArgs>
export default meta
type Story = StoryObj<typeof meta>

export const Bill: Story = { args: { kind: "bill" } }
export const Person: Story = { args: { kind: "person" } }
export const Organization: Story = { args: { kind: "organization" } }
export const Meeting: Story = { args: { kind: "meeting" } }
export const Document: Story = { args: { kind: "document" } }
export const Amendment: Story = { args: { kind: "amendment" } }
export const Vote: Story = { args: { kind: "vote" } }
export const Material: Story = { args: { kind: "material" } }

function groupedRecords(kinds: EntityKind[], compact: boolean) {
  const items = kinds.map((kind) => {
    const item = capturedCards.find((capture) => capture.record.kind === kind)
    invariant(item, `Missing ${kind} capture`)
    return item
  })
  const data = presentationBlockSchema.parse({
    state: "ready",
    blockId: "grouped-records",
    records: items.map((item) => item.record),
    spec: {
      root: "group",
      elements: {
        group: {
          type: compact ? "CompactRecordGroup" : "RecordGroup",
          props: { records: items.map((item) => ({ resultId: item.resultId, recordId: item.record.id })) },
          children: []
        }
      }
    }
  })
  return <ComposedRecord isRunning={false} part={{ type: "data-presentation", id: data.blockId, data }} />
}

export const FullRecordGroup: Story = {
  render: () => groupedRecords(["bill", "amendment", "vote"], false),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("region", { name: "3 records in this answer" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Add all to issue" })).toBeVisible()
    await expect(canvas.queryByRole("button", { name: "Add to issue" })).not.toBeInTheDocument()
  }
}

export const CompactRecordGroup: Story = {
  render: () => groupedRecords(["bill", "person", "vote", "meeting"], true),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("region", { name: "4 records in this answer" })).toBeVisible()
    await expect(canvas.getByRole("button", { name: "Add all to issue" })).toBeVisible()
    await expect(canvasElement.querySelector("dl")).not.toBeInTheDocument()
  }
}

export const BillProgress: Story = {
  render: () => {
    const capture = toolCaptures.find((capture) => capture.toolName === "get_bill")
    invariant(capture)
    const content = projectPresentationContents(
      capture.toolName,
      capture.output.data,
      [],
      capture.output.resultSet
    ).find((content) => content.kind === "bill-progress")
    invariant(content, "Refresh bill progress capture")
    const data = presentationBlockSchema.parse({
      state: "ready",
      blockId: "bill-progress",
      records: [],
      content,
      spec: {
        root: "progress",
        elements: { progress: { type: "BillProgressCard", props: { contentId: content.id }, children: [] } }
      }
    })
    return <ComposedRecord isRunning={false} part={{ type: "data-presentation", id: data.blockId, data }} />
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("region", { name: "Bill milestones" })).toBeVisible()
    await expect(canvas.getByRole("link", { name: "Open" })).toBeVisible()
    await expect(canvas.queryByText("Not reached")).not.toBeInTheDocument()
  }
}

export const CompactCards: Story = {
  render: ({ kind }) => (
    <div className={compactStyles.group}>
      {capturedCards
        .filter((capture) => !kind || capture.record.kind === kind)
        .map(({ record, resultId }) => (
          <ComposedRecord
            key={record.id}
            isRunning={false}
            part={{
              type: "data-presentation",
              id: record.id,
              data: {
                state: "ready",
                blockId: record.id,
                records: [record],
                spec: {
                  root: "compact",
                  elements: {
                    compact: { type: "CompactRecordCard", props: { resultId, recordId: record.id }, children: [] }
                  }
                }
              }
            }}
          />
        ))}
    </div>
  ),
  args: { kind: undefined },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button", { name: "Add to issue" })).not.toBeInTheDocument()
    await expect(within(canvasElement).queryByRole("button", { name: "Follow record" })).not.toBeInTheDocument()
  }
}

export const CompactBill: Story = { ...CompactCards, args: { kind: "bill" } }
export const CompactPerson: Story = { ...CompactCards, args: { kind: "person" } }
export const CompactOrganization: Story = { ...CompactCards, args: { kind: "organization" } }
export const CompactMeeting: Story = { ...CompactCards, args: { kind: "meeting" } }
export const CompactDocument: Story = { ...CompactCards, args: { kind: "document" } }
export const CompactAmendment: Story = { ...CompactCards, args: { kind: "amendment" } }
export const CompactVote: Story = { ...CompactCards, args: { kind: "vote" } }
export const CompactMaterial: Story = { ...CompactCards, args: { kind: "material" } }

const pendingPart = {
  type: "data-presentation",
  id: "pending-record",
  data: { state: "pending", blockId: "pending-record" }
}

export const Loading: Story = {
  render: () => <ComposedRecord isRunning part={pendingPart} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Loading content...")
    await expect(within(canvasElement).getByText("Reading")).toBeVisible()
    await expect(canvasElement.querySelectorAll('[class*="ComposedRecord_skeleton__"]')).toHaveLength(2)
    await expect(within(canvasElement).queryByText("This content could not be displayed.")).not.toBeInTheDocument()
  }
}

export const Interrupted: Story = {
  render: () => <ComposedRecord isRunning={false} part={pendingPart} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("The response ended before this content was ready.")).toBeVisible()
    await expect(within(canvasElement).getByText("Interrupted")).toBeVisible()
    await expect(within(canvasElement).queryByRole("status")).not.toBeInTheDocument()
  }
}

export const InvalidReference: Story = {
  render: () => {
    const capture = capturedCards.find(({ record }) => record.kind === "bill")
    invariant(capture, "Missing bill capture")
    return (
      <ComposedRecord
        isRunning={false}
        part={{
          type: "data-presentation",
          id: "mismatched-record",
          data: {
            state: "ready",
            blockId: "mismatched-record",
            records: [capture.record],
            spec: {
              root: "record",
              elements: {
                record: {
                  type: "RecordCard",
                  props: { resultId: capture.resultId, recordId: "unretrieved-record" },
                  children: []
                }
              }
            }
          }
        }}
      />
    )
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("This content could not be displayed.")).toBeVisible()
    await expect(canvas.getByText("Invalid reference")).toBeVisible()
    await expect(canvas.queryByRole("region", { name: /^Bill:/ })).not.toBeInTheDocument()
  }
}

export const Unavailable: Story = {
  render: () => (
    <ComposedRecord
      isRunning={false}
      part={{
        type: "data-presentation",
        id: "invalid-presentation-1",
        data: { state: "error", blockId: "invalid-presentation-1", reason: "records", component: "RecordCard" }
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("A selected record could not be loaded.")).toBeVisible()
    await expect(within(canvasElement).getByText("Unavailable")).toBeVisible()
  }
}
