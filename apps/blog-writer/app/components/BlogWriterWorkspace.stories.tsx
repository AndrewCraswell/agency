import type { Meta, StoryObj } from "@storybook/react-vite"
import { BlogWriterWorkspace } from "./BlogWriterWorkspace"

const meta = {
  title: "Blog writer/Workspace",
  component: BlogWriterWorkspace,
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta<typeof BlogWriterWorkspace>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const Generating: Story = {
  args: {
    isGenerating: true
  }
}
