import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"
import { VoteDetails } from "../components/VoteDetails"
import { DrawerExample, drawerRequestState, drawerSelection } from "./drawerExamples"

const meta = {
  title: "Conversation/VoteDetails",
  parameters: { layout: "padded" },
  args: { selection: drawerSelection("vote") },
  render: ({ selection }) => (
    <DrawerExample label="Vote details">
      {({ isOpen, ...callbacks }) => <VoteDetails selection={isOpen ? selection : undefined} {...callbacks} />}
    </DrawerExample>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole("dialog", { name: "Vote details" })).toBeVisible()
    await expect(await body.findByText("Published positions")).toBeVisible()
  }
} satisfies Meta<{ selection: ReturnType<typeof drawerSelection> }>
export default meta
type Story = StoryObj<typeof meta>
export const ReportedCounts: Story = {}
export const NextPositionsPage: Story = {
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const next = await body.findByRole("button", { name: "Next positions" })
    await userEvent.click(next)
    await expect(await body.findByText("26–50")).toBeVisible()
  }
}
export const CommitteeVote: Story = { args: { selection: drawerSelection("vote", 1) } }
export const Loading: Story = {
  beforeEach: drawerRequestState("loading"),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement.ownerDocument.body).findByText("Loading vote details...")).toBeVisible()
  }
}
export const Failed: Story = {
  beforeEach: drawerRequestState("failed"),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("button", { name: "Try again" })
    ).toBeVisible()
  }
}
export const Expired: Story = {
  beforeEach: drawerRequestState("expired"),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        "This result has expired. Ask a new question to retrieve current results."
      )
    ).toBeVisible()
  }
}
