import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"
import { ComparisonExampleFrame } from "../stories/ComparisonExampleFrame"
import { stateWordingDescription, stateWordingExample } from "../stories/comparisonExamples"
import { ComparisonCard, type ComparisonCardProps } from "./ComparisonCard"

const meta = {
  title: "Comparisons/ComparisonCard",
  component: ComparisonCard,
  parameters: { layout: "padded" },
  args: {
    ...stateWordingExample,
    exampleDescription: stateWordingDescription
  },
  render: ({ exampleDescription, ...args }) => (
    <ComparisonExampleFrame description={exampleDescription}>
      <ComparisonCard {...args} />
    </ComparisonExampleFrame>
  )
} satisfies Meta<ComparisonCardProps & { exampleDescription: string }>
export default meta
type Story = StoryObj<typeof meta>

export const OpenAndCollapse: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole("button", { name: "Open text comparison" })
    trigger.focus()
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByRole("region", { name: "Text comparison" })).toBeVisible()
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(trigger).toHaveFocus()
    await userEvent.keyboard(" ")
    await expect(trigger).toHaveAttribute("aria-expanded", "false")
    await expect(canvas.queryByRole("region", { name: "Text comparison" })).not.toBeInTheDocument()
    await expect(trigger).toHaveFocus()
  }
}

export const Expanded: Story = { args: { defaultOpen: true } }
