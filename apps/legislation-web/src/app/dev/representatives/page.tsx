import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AppShell } from "../../../components/shell/AppShell"
import { RepresentativeLookup } from "../../../modules/representatives/components/RepresentativeLookup"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Representative lookup | Rostra",
  robots: { index: false, follow: false }
}

export default function RepresentativesPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound()
  }

  return (
    <AppShell>
      <RepresentativeLookup />
    </AppShell>
  )
}
