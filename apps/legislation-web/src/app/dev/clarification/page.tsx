import { notFound } from "next/navigation"
import { ClarificationPreview } from "./ClarificationPreview"

export const metadata = { title: "Clarification preview | Rostra", robots: { index: false, follow: false } }

export default function ClarificationPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound()
  }
  return <ClarificationPreview />
}
