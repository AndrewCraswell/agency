import { Eye } from "lucide-react"
import { delay, http, HttpResponse } from "msw"
import { useState, type ReactNode } from "react"
import invariant from "tiny-invariant"
import { z } from "zod"
import { network } from "../../../../.storybook/mocks"
import { Button } from "../../../components/ui/button"
import { evidenceSnapshotSchema } from "../evidence"
import { capturedCards, reviewData, toolCaptures } from "./reviewFixtures"

export function DrawerExample({
  label,
  children
}: {
  label: string
  children: (props: { isOpen: boolean; onClose: () => void; returnFocus: () => void }) => ReactNode
}) {
  const [isOpen, setIsOpen] = useState(true)
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null)
  return (
    <>
      <Button ref={setTrigger} variant="outline" onClick={() => setIsOpen(true)}>
        <Eye aria-hidden="true" />
        {label}
      </Button>
      {children({ isOpen, onClose: () => setIsOpen(false), returnFocus: () => trigger?.focus() })}
    </>
  )
}

export function drawerSelection(kind: "vote" | "meeting", index = 0) {
  const captures = capturedCards.filter(
    ({ record, resultId }) => record.kind === kind && reviewData.details[`${resultId}/${record.id}`]
  )
  const capture = captures[index]
  invariant(capture, `Missing captured ${kind} drawer ${index}`)
  return { resultId: capture.resultId, recordId: capture.record.id }
}

export function drawerRequestState(state: "loading" | "failed" | "expired") {
  return () => {
    network.use(
      http.post("*/chat", async () => {
        if (state === "loading") {
          await delay("infinite")
        }
        return HttpResponse.json(
          { error: "Simulated drawer request failure" },
          { status: state === "expired" ? 410 : 503 }
        )
      })
    )
    return () => network.resetHandlers()
  }
}

const comparison = toolCaptures.find((capture) => capture.toolName === "compare_bill_versions")
const document = z
  .object({
    data: z.object({
      documents: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          sourceUrl: z.string(),
          versionCode: z.string().nullable(),
          text: z.string()
        })
      )
    })
  })
  .parse(comparison?.output).data.documents[1]
invariant(document, "Missing captured evidence document")
export const drawerEvidence = evidenceSnapshotSchema.parse({
  id: document.id,
  title: document.title,
  origin: "canonical",
  sourceUrl: document.sourceUrl,
  versionLabel: document.versionCode ?? undefined,
  content: { state: "available", quote: document.text }
})
