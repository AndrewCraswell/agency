import type { Meta, StoryObj } from "@storybook/react-vite"
import { TemplatePreview } from "../../../../preview/TemplatePreview.tsx"

const meta = {
  title: "Customer notifications/Customer marketing confirmation",
  component: TemplatePreview,
  args: { templateId: "customer_marketing_confirmation" }
} satisfies Meta<typeof TemplatePreview>

export default meta

export const Standard: StoryObj<typeof meta> = {
  name: "Standard",
  args: { variationId: "standard" }
}
