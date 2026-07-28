import type { Meta, StoryObj } from "@storybook/react-vite"
import { TemplatePreview } from "../../../preview/TemplatePreview.tsx"

const meta = {
  title: "Printouts/Invoice",
  component: TemplatePreview,
  args: { templateId: "invoice" }
} satisfies Meta<typeof TemplatePreview>

export default meta

export const BalanceDue: StoryObj<typeof meta> = {
  name: "Balance due",
  args: { variationId: "unpaid" }
}

export const PaidInFull: StoryObj<typeof meta> = {
  name: "Paid in full",
  args: { variationId: "paid" }
}

export const MultiPage: StoryObj<typeof meta> = {
  name: "Multi-page",
  args: { variationId: "multipage" }
}
