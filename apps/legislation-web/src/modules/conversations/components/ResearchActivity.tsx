import type { UIMessage } from "ai"
import { CircleCheck, CircleAlert, LoaderCircle, Circle, ChevronDown, FileSearch } from "lucide-react"
import { useState } from "react"
import { z } from "zod"
import { Badge } from "../../../components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../components/ui/collapsible"
import { entityPageSchema } from "../entityResults"
import { researchToolLabels } from "../researchTools"
import * as styles from "./ConversationResponse.css"

type ResearchActivityProps = Readonly<{
  part: Extract<UIMessage["parts"][number], { type: "dynamic-tool" }>
  isRunning: boolean
}>

const activityInputSchema = z.object({
  query: z.string().max(500).nullable().optional(),
  id: z.string().max(500).nullable().optional()
})
const activityOutputSchema = z.object({ data: z.object({ items: z.array(z.unknown()) }) })
const activityResultSchema = z.object({ resultSet: entityPageSchema.pick({ items: true }) })

export function ResearchActivity({ part, isRunning }: ResearchActivityProps) {
  const [isErrorExpanded, setIsErrorExpanded] = useState(true)
  const label =
    part.toolName === "ask_clarification" ? "Clarify question" : (researchToolLabels[part.toolName] ?? "Research")
  let state = "Pending"
  let Icon = Circle
  let stateClass = styles.activityPending
  const input = activityInputSchema.safeParse(part.input)
  const output = part.state === "output-available" ? activityOutputSchema.safeParse(part.output) : undefined
  let detail = input.success ? input.data.query : undefined
  if (!detail && input.success && input.data.id) {
    const result = part.state === "output-available" ? activityResultSchema.safeParse(part.output) : undefined
    const record = result?.success ? result.data.resultSet.items.find((item) => item.id === input.data.id) : undefined
    detail = record?.title || input.data.id
  }
  if (part.state === "output-available") {
    state = "Complete"
    Icon = CircleCheck
    stateClass = styles.activityComplete
  } else if (part.state === "output-error" || part.state === "output-denied") {
    state = "Failed"
    Icon = CircleAlert
    stateClass = styles.activityFailed
  } else if (!isRunning) {
    state = "Interrupted"
    Icon = CircleAlert
  } else if (part.state === "input-available") {
    state = "Running"
    Icon = LoaderCircle
  }

  if (part.state === "output-error" || part.state === "output-denied") {
    return (
      <Collapsible className={styles.failedTool} open={isErrorExpanded} onOpenChange={setIsErrorExpanded}>
        <CollapsibleTrigger className={styles.failedToolTrigger}>
          <FileSearch className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 break-words text-left">{label}</span>
          <Badge variant="secondary" className={styles.failedToolBadge}>
            Could not complete
          </Badge>
          <ChevronDown
            className={`size-4 shrink-0 text-subtle ${isErrorExpanded ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className={styles.failedToolDetails}>
          {detail && <p className="break-words text-[13px]">{detail}</p>}
          <p className={styles.failedToolError}>
            {part.state === "output-error" ? part.errorText : "This operation was not permitted."}
          </p>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  return (
    <div className={styles.activityStep}>
      <div className={styles.activityHeading} aria-label={`${label}: ${state}`}>
        <Icon
          className={`${stateClass} ${state === "Running" ? styles.spinner : "size-4 shrink-0"}`}
          aria-hidden="true"
        />
        <span className={styles.activityLabel}>{label}</span>
        <span className={styles.activityCount}>{state}</span>
      </div>
      {(detail || output?.success) && (
        <div className={styles.activityDetails}>
          <span className="min-w-0 flex-1 break-words">{detail}</span>
          {output?.success && (
            <span className="shrink-0 font-mono">
              {new Intl.NumberFormat().format(output.data.data.items.length)} returned
            </span>
          )}
        </div>
      )}
    </div>
  )
}
