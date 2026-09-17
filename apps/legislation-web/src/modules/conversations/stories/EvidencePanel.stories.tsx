import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, within } from "storybook/test"
import { EvidencePanel } from "../components/EvidencePanel"
import type { EvidenceSnapshot } from "../evidence"
import { DrawerExample, drawerEvidence } from "./drawerExamples"

const meta = {
  title: "Conversation/EvidencePanel",
  parameters: { layout: "padded" },
  args: { evidence: drawerEvidence },
  render: ({ evidence }) => (
    <DrawerExample label="Source">
      {({ isOpen, ...callbacks }) => (
        <EvidencePanel
          selection={isOpen ? { answerId: "drawer-story", number: 1, evidence } : undefined}
          {...callbacks}
        />
      )}
    </DrawerExample>
  ),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByRole("dialog", { name: "Source 1" })).toBeVisible()
    await expect(body.getByRole("button", { name: "Copy citation" })).toBeVisible()
  }
} satisfies Meta<{ evidence: EvidenceSnapshot }>
export default meta
type Story = StoryObj<typeof meta>
export const RetrievedPassage: Story = {}
export const NoPassage: Story = { args: { evidence: { ...drawerEvidence, content: { state: "not-collected" } } } }
export const SourceUnavailable: Story = {
  args: { evidence: { ...drawerEvidence, sourceUrl: null, content: { state: "unavailable" } } }
}
