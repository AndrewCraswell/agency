"use client"

import { Button } from "../../../components/ui/button"
import type { EntityCard } from "../entityResults"
import { CompactRecordCard, RecordCard, recordActionUnavailable } from "./EntityResults"
import * as styles from "./RecordGroup.css"

export function RecordGroup({
  items,
  compact = false,
  onOpenRecord
}: Readonly<{
  items: ReadonlyArray<{ record: EntityCard; resultId: string }>
  compact?: boolean
  onOpenRecord: (recordId: string) => void
}>) {
  const count = new Intl.NumberFormat().format(items.length)
  const label = `${count} ${items.length === 1 ? "record" : "records"} in this answer`
  return (
    <section className={styles.group} aria-label={label} data-compact={compact}>
      <div className={styles.header}>
        <h4 className={styles.label}>{label}</h4>
        <Button variant="ghost" size="xs" className={styles.action} onClick={recordActionUnavailable}>
          Add all to issue
        </Button>
      </div>
      {items.map(({ record, resultId }) => (
        <div key={record.id} className={styles.row}>
          {compact ? (
            <CompactRecordCard record={record} resultId={resultId} onOpenVote={onOpenRecord} isGrouped />
          ) : (
            <RecordCard record={record} resultId={resultId} onOpenVote={onOpenRecord} isGrouped />
          )}
        </div>
      ))}
    </section>
  )
}
