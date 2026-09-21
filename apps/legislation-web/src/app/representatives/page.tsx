import type { Metadata } from "next"
import { AppShell } from "../../components/shell/AppShell"
import { RepresentativeLookup } from "../../modules/representatives/components/RepresentativeLookup"

export const metadata: Metadata = {
  title: "Find your representatives | Rostra"
}

export default function RepresentativesPage() {
  return (
    <AppShell>
      <RepresentativeLookup />
    </AppShell>
  )
}
