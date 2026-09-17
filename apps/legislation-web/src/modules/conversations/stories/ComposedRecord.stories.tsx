import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"
import invariant from "tiny-invariant"
import { StickToBottom } from "use-stick-to-bottom"
import { ComposedRecord } from "../components/ComposedRecord"
import type { EntityKind } from "../entityResults"
import { capturedCards } from "./reviewFixtures"
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

const pendingPart = {
  type: "data-presentation",
  id: "pending-record",
  data: { state: "pending", blockId: "pending-record" }
}

export const Loading: Story = {
  render: () => <ComposedRecord isRunning part={pendingPart} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Loading content...")
    await expect(within(canvasElement).queryByText("This content could not be displayed.")).not.toBeInTheDocument()
  }
}

export const Interrupted: Story = {
  render: () => <ComposedRecord isRunning={false} part={pendingPart} />,
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("This content could not be displayed.")).toBeVisible()
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
        data: { state: "error", blockId: "invalid-presentation-1" }
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText("This content could not be displayed.")).toBeVisible()
  }
}
