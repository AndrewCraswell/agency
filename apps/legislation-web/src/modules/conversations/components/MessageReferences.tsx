import type { UIMessage } from "ai"
import { CalendarDays, FileDiff, FileText, Gavel, Landmark, ScrollText, UserRound } from "lucide-react"
import { Badge } from "../../../components/ui/badge"
import { messageReferenceSnapshots } from "../chatRequest"
import { composerReferences, messageComposerDraft } from "../composerDraft"
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
  const inline = composerReferences(messageComposerDraft(message))
  const references = messageReferenceSnapshots(message).filter(
    (reference) =>
      !inline.some(
        (mention) => mention.recordId === reference.recordId && mention.record.kind === reference.record.kind
      )
  )
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

export function MessageQuestion({ message }: Readonly<{ message: UIMessage }>) {
  return (
    <p className={styles.question}>
      {messageComposerDraft(message).map((segment, index) => {
        if (segment.type === "text") {
          return segment.text
        }
        const Icon = icons[segment.reference.record.kind]
        return (
          <span
            key={`${segment.reference.recordId}-${index}`}
            className={styles.inlineTag}
            data-type="mention"
            data-id={segment.reference.recordId}
          >
            <Icon className={styles.inlineIcon} aria-hidden="true" />
            {segment.reference.record.title}
          </span>
        )
      })}
    </p>
  )
}
