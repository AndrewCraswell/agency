import type { UIMessage } from "ai"
import { CalendarDays, FileDiff, FileText, Gavel, Landmark, ScrollText, UserRound } from "lucide-react"
import { messageReferenceSnapshots } from "../../lib/chatRequest"
import { Badge } from "../ui/badge"
import * as styles from "./MessageReferences.css"

const icons = {
  bill: ScrollText,
  person: UserRound,
  organization: Landmark,
  meeting: CalendarDays,
  document: FileText,
  amendment: FileDiff,
  vote: Gavel,
  material: FileText
}

export function MessageReferences({ message }: Readonly<{ message: UIMessage }>) {
  const references = messageReferenceSnapshots(message)
  if (references.length === 0) {
    return null
  }
  return (
    <ul className={styles.list} aria-label="Submitted references">
      {references.map(({ record, recordId }) => {
        const Icon = icons[record.kind]
        return (
          <li key={`${record.kind}:${recordId}`} className={styles.item}>
            <Badge variant="outline" className={styles.chip}>
              <Icon className="size-[13px] shrink-0 text-primary" aria-hidden="true" />
              <span className={styles.title}>{record.title}</span>
              {record.subtitle && <span className={styles.metadata}>{record.subtitle}</span>}
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}
