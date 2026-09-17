import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"
import { entityKindSchema, entityLabels } from "../entityResults"
import { researchToolLabels } from "../researchTools"
import { activityStates } from "./reviewFixtures"
import { ReviewGallery } from "./ReviewGallery"

const meta = {
  title: "Review/Conversation",
  component: ReviewGallery,
  argTypes: {
    view: { control: "select", options: ["all", "cards", "accordions", "activity", "errors"] },
    toolName: { control: "select", options: [undefined, ...Object.keys(researchToolLabels)] },
    kind: { control: "select", options: [undefined, ...entityKindSchema.options] },
    state: { control: "select", options: [undefined, ...activityStates] }
  }
} satisfies Meta<typeof ReviewGallery>
export default meta
type Story = StoryObj<typeof meta>

const prepareAccordions: NonNullable<Story["play"]> = async ({ canvasElement, userEvent }) => {
  const canvas = within(canvasElement)
  const expanded = within(canvas.getByRole("region", { name: "Complete / expanded" }))
  const toggle = expanded.getByRole("button", { name: /Research activity/ })
  if (toggle.getAttribute("aria-expanded") !== "true") {
    await userEvent.click(toggle)
  }
  const mixed = within(canvas.getByRole("region", { name: "Mixed outcomes" }))
  const activity = mixed.getByRole("button", { name: "Research activity 2 steps" })
  if (activity.getAttribute("aria-expanded") !== "true") {
    await userEvent.click(activity)
  }
  const failure = mixed.getByRole("button", { name: /: Failed$/ })
  if (failure.getAttribute("aria-expanded") !== "false") {
    await userEvent.click(failure)
  }
  await expect(mixed.getByLabelText("Search bills: Complete")).toBeVisible()
  await expect(failure).toBeVisible()
  await expect(canvas.queryByRole("region", { name: "Failure / collapsed" })).not.toBeInTheDocument()
}

export const All: Story = {
  args: { view: "all" },
  play: async (context) => {
    const canvas = within(context.canvasElement)
    for (const kind of entityKindSchema.options) {
      const label = entityLabels[kind].singular
      await expect(canvas.getByRole("region", { name: `${label} examples` })).toBeVisible()
    }
    await prepareAccordions(context)
  }
}
