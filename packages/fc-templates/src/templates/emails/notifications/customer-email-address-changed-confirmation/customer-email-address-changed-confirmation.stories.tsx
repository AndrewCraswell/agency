import type { Meta, StoryObj } from "@storybook/react-vite"
import { TemplatePreview } from "../../../../preview/TemplatePreview.tsx"

const meta = {
  title: "Customer notifications/Customer email address change confirmation",
  component: TemplatePreview,
  args: { templateId: "customer_email_address_changed_confirmation" }
} satisfies Meta<typeof TemplatePreview>

export default meta

export const Standard: StoryObj<typeof meta> = {
  name: "Standard",
  args: { variationId: "standard" }
}
