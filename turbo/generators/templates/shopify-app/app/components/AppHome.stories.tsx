import type { Meta, StoryObj } from "@storybook/react-vite"
import { AppHome } from "./AppHome"

const meta = {
  title: "Shopify app/Home",
  component: AppHome,
  parameters: {
    layout: "fullscreen"
  }
} satisfies Meta<typeof AppHome>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
