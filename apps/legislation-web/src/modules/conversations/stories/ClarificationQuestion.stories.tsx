import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn, within } from "storybook/test"
import type { ClarificationRequest } from "../clarification"
import { ClarificationQuestion } from "../components/ClarificationQuestion"

const request: ClarificationRequest = {
  id: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  state: "pending",
  input: {
    kind: "single",
    question: "Which jurisdictions should I compare?",
    allowSkip: true,
    allowFreeText: true,
    options: [
      { id: "federal", label: "Congress" },
      { id: "states", label: "State legislatures" }
    ]
  }
}
const meta: Meta<typeof ClarificationQuestion> = {
  title: "Conversation/ClarificationQuestion",
  component: ClarificationQuestion,
  parameters: { layout: "padded" },
  args: { request, onAnswer: fn(async () => undefined) }
}
export default meta
type Story = StoryObj<typeof meta>
export const SingleChoice: Story = {}
export const MultipleChoice: Story = {
  args: {
    request: {
      ...request,
      input: {
        ...request.input,
        kind: "multiple",
        minSelections: 1,
        maxSelections: 2,
        options: [
          { id: "federal", label: "Congress" },
          { id: "states", label: "State legislatures" }
        ],
        allowFreeText: true
      }
    }
  }
}
export const FreeText: Story = {
  args: {
    request: {
      ...request,
      input: { kind: "text", question: "Which policy topic should I investigate?", allowSkip: true }
    }
  }
}
export const Answered: Story = {
  args: {
    acceptedResponse: { requestId: request.id, revision: 1, status: "answered", selectedIds: ["states"], text: "" }
  }
}
export const Skipped: Story = { args: { acceptedResponse: { requestId: request.id, revision: 1, status: "skipped" } } }
export const Expired: Story = { args: { request: { ...request, state: "expired" } } }
export const Superseded: Story = { args: { request: { ...request, state: "superseded" } } }
export const SubmissionFailed: Story = {
  args: {
    onAnswer: async () => {
      throw new Error("Simulated confirmation failure")
    }
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole("radio", { name: "Congress" }))
    await userEvent.click(canvas.getByRole("button", { name: "Continue" }))
    await expect(canvas.getByText("Your answer could not be confirmed. Try again.")).toBeVisible()
  }
}
