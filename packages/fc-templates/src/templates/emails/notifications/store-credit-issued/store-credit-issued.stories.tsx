import type { Meta, StoryObj } from "@storybook/react-vite"
import { TemplatePreview } from "../../../../preview/TemplatePreview.tsx"

const meta = {
  title: "Customer notifications/Store credit issued",
  component: TemplatePreview,
  args: { templateId: "store_credit_issued" }
} satisfies Meta<typeof TemplatePreview>

export default meta

export const Standard: StoryObj<typeof meta> = {
  name: "Standard",
  args: { variationId: "standard" }
}
