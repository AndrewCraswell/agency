import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, within } from "storybook/test"
import { ComparisonExampleFrame } from "../stories/ComparisonExampleFrame"
import {
  federalRevisionDescription,
  federalRevisionExample,
  chapterCollisionDescription,
  chapterCollisionExample,
  pendingDocuments,
  stateWordingDescription,
  stateWordingExample,
  unchangedExample
} from "../stories/comparisonExamples"
import { DiffViewer, type DiffViewerProps } from "./DiffViewer"

const meta = {
  title: "Comparisons/DiffViewer",
  component: DiffViewer,
  parameters: { layout: "padded" },
  args: {
    ...stateWordingExample,
    exampleDescription: stateWordingDescription
  },
  render: ({ exampleDescription, ...args }) => (
    <ComparisonExampleFrame description={exampleDescription}>
      <DiffViewer {...args} />
    </ComparisonExampleFrame>
  )
} satisfies Meta<DiffViewerProps & { exampleDescription: string }>
export default meta
type Story = StoryObj<typeof meta>

export const StateWordingChanges: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("region", { name: "Text comparison" })).toBeVisible()
    await expect(canvas.getByRole("table")).toBeVisible()
    const split = canvas.getByRole("button", { name: "Side by side" })
    split.focus()
    await userEvent.keyboard("{Enter}")
    await expect(split).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(canvas.getByRole("button", { name: "Unified" }))
  }
}

export const SideBySide: Story = {
  args: { defaultViewMode: "split" }
}

export const OwnershipWhistleblowerChapter53: Story = {
  args: {
    ...chapterCollisionExample,
    exampleDescription: chapterCollisionDescription,
    defaultShowUnchanged: true
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(chapterCollisionExample.state.comparison.left.id)).toBeVisible()
    await expect(canvas.getByText(chapterCollisionExample.state.comparison.right.id)).toBeVisible()
    await expect(canvas.getByRole("table")).toBeVisible()
  }
}

export const FederalBillRevision: Story = {
  args: {
    ...federalRevisionExample,
    exampleDescription: federalRevisionDescription,
    defaultShowUnchanged: false
  }
}

export const Unchanged: Story = {
  args: {
    ...unchangedExample,
    exampleDescription:
      "Unchanged-state demonstration: the same captured AB 2652 document is compared against itself, not presented as two different published versions."
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText("No textual differences found.")).toBeVisible()
    await userEvent.click(canvas.getByRole("checkbox", { name: "Show full context" }))
    await expect(canvas.getByRole("table")).toBeVisible()
  }
}

export const Loading: Story = {
  args: {
    state: { status: "loading", ...pendingDocuments },
    exampleDescription: "Document identities stay visible while a comparison result loads."
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("status")).toHaveTextContent("Loading text comparison...")
    await expect(canvas.getByRole("region", { name: "Text comparison" })).toHaveAttribute("aria-busy", "true")
  }
}

export const Error: Story = {
  args: {
    state: { status: "error", ...pendingDocuments },
    exampleDescription: "A failed request exposes a retry action without presenting an empty diff as success.",
    onRetry: fn()
  },
  play: async ({ canvasElement, userEvent, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole("alert")).toHaveTextContent("Couldn't load the text comparison.")
    await userEvent.click(canvas.getByRole("button", { name: "Try again" }))
    await expect(args.onRetry).toHaveBeenCalledOnce()
  }
}

export const Unavailable: Story = {
  args: {
    state: { status: "unavailable", ...pendingDocuments },
    exampleDescription: "Missing comparison data is unavailable, not unchanged."
  }
}
