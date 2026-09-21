"use client"

import type { PresentationContent } from "../presentationContent"
import { CardActions, RecordIdentity } from "./EntityResults"
import * as styles from "./BillProgressCard.css"
import * as recordStyles from "./EntityResults.css"

export function BillProgressCard({
  content
}: Readonly<{ content: Extract<PresentationContent, { kind: "bill-progress" }> }>) {
  const { record, stages } = content
  const title =
    record.identifier && record.title.startsWith(`${record.identifier} `)
      ? record.title.slice(record.identifier.length + 1)
      : record.title
  return (
    <section className={recordStyles.fullCard} aria-label={`Bill progress: ${record.title}`}>
      <RecordIdentity record={record} label="Bill progress">
        <h4 className={recordStyles.fullTitle}>{title}</h4>
      </RecordIdentity>
      <div
        className={styles.region}
        role={stages.length > 0 ? "region" : undefined}
        aria-label="Bill milestones"
        tabIndex={stages.length > 0 ? 0 : undefined}
      >
        <ol className={styles.path}>
          {stages.map((stage, index) => (
            <li
              key={stage.id}
              className={styles.stage}
              data-state={stage.state}
              data-connected={
                stage.state !== "unknown" && stages[index + 1] !== undefined && stages[index + 1]?.state !== "unknown"
              }
              aria-current={stage.state === "current" ? "step" : undefined}
            >
              <span className={styles.track} aria-hidden="true">
                <span className={styles.dot} />
              </span>
              <span className={styles.label}>{stage.label}</span>
              <span className={styles.date}>
                {stage.date ? (
                  <time dateTime={stage.date}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
                      new Date(`${stage.date}T00:00:00Z`)
                    )}
                  </time>
                ) : (
                  <>{stage.state === "unknown" ? "Not recorded" : "Date not recorded"}</>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
      {content.hasMore && (
        <p className={styles.notice}>More recorded actions are available. Milestones may be incomplete.</p>
      )}
      <CardActions record={record} resultId={content.resultId} isFollowing={false} onOpenRecord={() => undefined} />
    </section>
  )
}
