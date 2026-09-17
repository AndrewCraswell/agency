import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"
import { MeetingDetails } from "../components/MeetingDetails"
import { DrawerExample, drawerRequestState, drawerSelection } from "./drawerExamples"
import { reviewData } from "./reviewFixtures"

const meta = {
  title: "Conversation/MeetingDetails",
  parameters: { layout: "padded" },
  args: { selection: drawerSelection("meeting") },
  render: ({ selection }) => (
    <DrawerExample label="Meeting">
      {({ isOpen, ...callbacks }) => <MeetingDetails selection={isOpen ? selection : undefined} {...callbacks} />}
    </DrawerExample>
  ),
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole("dialog", { name: "Meeting" })).toBeVisible()
    const details = reviewData.details[`${args.selection.resultId}/${args.selection.recordId}`]
    await expect(await body.findByRole("heading", { name: details!.record.title })).toBeVisible()
  }
} satisfies Meta<{ selection: ReturnType<typeof drawerSelection> }>
export default meta
type Story = StoryObj<typeof meta>
export const OrganizationalMeeting: Story = {}
export const Hearing: Story = { args: { selection: drawerSelection("meeting", 1) } }
export const LongTitle: Story = { args: { selection: drawerSelection("meeting", 3) } }
export const Loading: Story = {
  beforeEach: drawerRequestState("loading"),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement.ownerDocument.body).findByText("Loading meeting details...")).toBeVisible()
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
