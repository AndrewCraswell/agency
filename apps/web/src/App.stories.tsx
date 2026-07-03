import type { Meta, StoryObj } from "@storybook/react-vite"
import { AppShell } from "@/components/AppShell/AppShell"
import { App } from "./App"

const meta: Meta<typeof App> = {
  title: "App",
  component: App,
  decorators: [
    (Story) => (
      <AppShell>
        <Story />
      </AppShell>
    )
  ]
}

export default meta

type Story = StoryObj<typeof App>

export const Default: Story = {}
