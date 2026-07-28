import type { Meta, StoryObj } from "@storybook/react-vite"
import { TemplatePreview } from "../../../../preview/TemplatePreview.tsx"

const meta = {
  title: "Customer notifications/Order missed local delivery",
  component: TemplatePreview,
  args: { templateId: "local_missed_delivery" }
} satisfies Meta<typeof TemplatePreview>

export default meta

export const Standard: StoryObj<typeof meta> = {
  name: "Standard",
  args: { variationId: "standard" }
}
