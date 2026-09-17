import type { UIMessage } from "ai"
import { ArrowLeft } from "lucide-react"
import { useId, useRef, useState, type MouseEvent } from "react"
import { StickToBottom } from "use-stick-to-bottom"
import { AppShell } from "../../../components/shell/AppShell"
import { Button } from "../../../components/ui/button"
import { Checkbox } from "../../../components/ui/checkbox"
import { ComposedRecord } from "../components/ComposedRecord"
import { ConversationResponse } from "../components/ConversationResponse"
import { RecordProfile } from "../components/RecordProfile"
import { ResearchActivity } from "../components/ResearchActivity"
import { entityKindSchema, entityLabels, type EntityKind } from "../entityResults"
import { researchToolLabels } from "../researchTools"
import {
  activityPart,
  activityStates,
  capturedCards,
  failureCodes,
  reviewData,
  toolCaptures,
  type ActivityState
} from "./reviewFixtures"
import * as styles from "./ReviewGallery.css"

type ReviewGalleryProps = Readonly<{
  view?: "all" | "activity" | "cards" | "errors" | "accordions"
  toolName?: string
  kind?: EntityKind
  state?: ActivityState
}>
type ProfileSelection = { kind: "person" | "organization" | "material"; recordId: string; resultId: string }

function AccordionExamples() {
  const read = toolCaptures.find((capture) => capture.toolName === "get_bill")!
  const search = toolCaptures.find((capture) => capture.toolName === "search_bills")!
  const empty = toolCaptures.find((capture) => capture.output.resultSet?.items.length === 0)!
  const examples = [
    { label: "Complete / collapsed", parts: [activityPart(read, "Complete").part], running: false },
    {
      label: "Complete / expanded",
      parts: [activityPart(search, "Complete").part, activityPart(read, "Complete").part],
      running: false
    },
    {
      label: "Mixed outcomes",
      parts: [activityPart(search, "Complete").part, activityPart(read, "Failed").part],
      running: false
    },
    {
      label: "Active request",
      parts: [activityPart(search, "Complete").part, activityPart(read, "Running").part],
      running: true
    },
    {
      label: "Interrupted request",
      parts: [activityPart(search, "Complete").part, activityPart(read, "Interrupted request").part],
      running: false
    },
    { label: "Denied request", parts: [activityPart(read, "Denied").part], running: false },
    { label: "No tools", parts: [], running: false },
    { label: "No matches", parts: [activityPart(empty, "Complete").part], running: false }
  ]
  return (
    <div className={styles.grid}>
      {examples.map((example, index) => {
        const message: UIMessage = { id: `review-accordion-${index}`, role: "assistant", parts: example.parts }
        return (
          <section key={example.label} className={styles.sample} aria-label={example.label}>
            <h3 className={styles.label}>{example.label}</h3>
            <ConversationResponse
              message={message}
              isRunning={example.running}
              isIncomplete={example.label === "Interrupted request"}
              evidence={[]}
              onEvidence={() => undefined}
            />
          </section>
        )
      })}
    </div>
  )
}

export function ReviewGallery({ view = "all", toolName, kind, state }: ReviewGalleryProps) {
  const variantsId = useId()
  const [allVariants, setAllVariants] = useState(view === "all")
  const [profile, setProfile] = useState<ProfileSelection>()
  const lastHref = useRef<string | undefined>(undefined)
  const content = useRef<HTMLDivElement>(null)
  const selectedTools = toolCaptures.filter((capture) => !toolName || capture.toolName === toolName)
  const selectedKinds = entityKindSchema.options.filter((candidate) => !kind || candidate === kind)
  function returnToReview() {
    setProfile(undefined)
    requestAnimationFrame(() => {
      ;[...(content.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])]
        .find((link) => link.getAttribute("href") === lastHref.current)
        ?.focus({ preventScroll: true })
    })
  }
  function onNavigate(event: MouseEvent<HTMLDivElement>) {
    const link = event.target instanceof Element ? event.target.closest("a") : null
    if (!link) {
      return
    }
    const url = new URL(link.href)
    if (profile && url.pathname.startsWith("/conversations/")) {
      event.preventDefault()
      event.stopPropagation()
      returnToReview()
      return
    }
    const match = /^\/records\/(person|organization|material)\/([^/]+)$/.exec(url.pathname)
    const resultId = url.searchParams.get("result")
    if (!match || !resultId) {
      return
    }
    const selectedKind = match[1]
    if (selectedKind !== "person" && selectedKind !== "organization" && selectedKind !== "material") {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    lastHref.current = link.getAttribute("href") ?? undefined
    setProfile({ kind: selectedKind, recordId: decodeURIComponent(match[2]!), resultId })
  }
  if (profile) {
    return (
      <div onClickCapture={onNavigate}>
        <Button variant="ghost" onClick={returnToReview}>
          <ArrowLeft aria-hidden="true" />
          Back to review
        </Button>
        <RecordProfile {...profile} />
      </div>
    )
  }
  return (
    <StickToBottom initial={false} resize="instant">
      <div ref={content} onClickCapture={onNavigate}>
        <AppShell>
          <main className={styles.page}>
            <h1 className={styles.heading}>Conversation review</h1>
            <p className={styles.metadata}>
              Real-data capture started <time dateTime={reviewData.capturedAt}>{reviewData.capturedAt}</time>. Execution
              states and failures below are simulated; record facts are not altered.
            </p>
            <nav className={styles.navigation} aria-label="Review sections">
              <a href="#cards">Entity cards</a>
              <a href="#accordions">Accordions</a>
              <a href="#activity">Activity states</a>
              <a href="#errors">Failure messages</a>
            </nav>
            {(view === "all" || view === "cards") && (
              <section id="cards" className={styles.section}>
                <h2 className={styles.sectionHeading}>Entity cards</h2>
                <label htmlFor={variantsId} className={styles.actions}>
                  <Checkbox
                    id={variantsId}
                    checked={allVariants}
                    onCheckedChange={(value) => setAllVariants(value === true)}
                  />
                  All captured record variants
                </label>
                {selectedKinds.map((kind) => {
                  const candidates = capturedCards.filter((candidate) => candidate.record.kind === kind)
                  const selected = allVariants ? candidates : candidates.slice(0, 1)
                  return (
                    <section key={kind} className={styles.group} aria-label={`${entityLabels[kind].singular} examples`}>
                      <h3 className={styles.groupHeading}>{entityLabels[kind].plural}</h3>
                      <div className={styles.grid}>
                        {selected.map(({ record, resultId, toolName }) => {
                          const blockId = `review-${record.id}`
                          return (
                            <div key={record.id} className={styles.sample}>
                              <p className={styles.metadata}>
                                {toolName} / {record.id}
                              </p>
                              <ComposedRecord
                                isRunning={false}
                                part={{
                                  type: "data-presentation",
                                  id: blockId,
                                  data: {
                                    state: "ready",
                                    blockId,
                                    records: [record],
                                    spec: {
                                      root: "record",
                                      elements: {
                                        record: {
                                          type: "RecordCard",
                                          props: { resultId, recordId: record.id },
                                          children: []
                                        }
                                      }
                                    }
                                  }
                                }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </section>
            )}
            {(view === "all" || view === "accordions") && (
              <section id="accordions" className={styles.section}>
                <h2 className={styles.sectionHeading}>Accordion compositions</h2>
                <AccordionExamples />
              </section>
            )}
            {(view === "all" || view === "activity") && (
              <section id="activity" className={styles.section}>
                <h2 className={styles.sectionHeading}>Activity states</h2>
                {selectedTools.map((capture) => (
                  <section
                    key={capture.toolName}
                    className={styles.group}
                    aria-label={`${researchToolLabels[capture.toolName]} states`}
                  >
                    <h3 className={styles.groupHeading}>{researchToolLabels[capture.toolName]}</h3>
                    <p className={styles.metadata}>{capture.toolName}</p>
                    <div className={styles.grid}>
                      {(state ? [state] : activityStates).map((state) => (
                        <div key={state} className={styles.sample} data-review-state={state}>
                          <h4 className={styles.label}>{state}</h4>
                          <ResearchActivity
                            {...activityPart(capture, state)}
                            previousParts={toolCaptures
                              .slice(0, toolCaptures.indexOf(capture))
                              .map((previous) => activityPart(previous, "Complete").part)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
                <section className={styles.group}>
                  <h3 className={styles.groupHeading}>Fallback and clarification labels</h3>
                  <div className={styles.grid}>
                    {["ask_clarification", "unrecognized_tool"].map((toolName) => (
                      <div key={toolName}>
                        <ResearchActivity {...activityPart({ ...toolCaptures[0]!, toolName }, "Failed")} />
                      </div>
                    ))}
                  </div>
                </section>
              </section>
            )}
            {(view === "all" || view === "errors") && (
              <section id="errors" className={styles.section}>
                <h2 className={styles.sectionHeading}>Failure messages</h2>
                <div className={styles.grid}>
                  {failureCodes.map((code) => (
                    <section key={code} className={styles.sample} aria-label={code}>
                      <h3 className={styles.label}>{code}</h3>
                      <ResearchActivity {...activityPart(toolCaptures[0]!, "Failed", code)} />
                    </section>
                  ))}
                </div>
              </section>
            )}
          </main>
        </AppShell>
      </div>
    </StickToBottom>
  )
}
