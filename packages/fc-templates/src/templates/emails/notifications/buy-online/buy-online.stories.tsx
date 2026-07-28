import type { Meta, StoryObj } from "@storybook/react-vite"
import { TemplatePreview } from "../../../../preview/TemplatePreview.tsx"

const meta = {
  title: "Customer notifications/POS abandoned checkout",
  component: TemplatePreview,
  args: { templateId: "buy_online" }
} satisfies Meta<typeof TemplatePreview>

export default meta

export const Standard: StoryObj<typeof meta> = {
  name: "Standard",
  args: { variationId: "standard" }
}
