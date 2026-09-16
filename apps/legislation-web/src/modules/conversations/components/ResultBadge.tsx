import { CircleCheck, CircleMinus, CircleX, Clock3 } from "lucide-react"
import { Badge } from "../../../components/ui/badge"
import { resultTone } from "../entityResults"
import * as styles from "./ResultBadge.css"

const icons = { success: CircleCheck, danger: CircleX, pending: Clock3, neutral: CircleMinus }

export function ResultBadge({ outcome }: Readonly<{ outcome: string }>) {
  const tone = resultTone(outcome)
  const Icon = icons[tone]
  return (
    <Badge variant="outline" className={styles.badge} data-result-tone={tone}>
      <Icon className={styles.icon} aria-hidden="true" />
      {outcome}
    </Badge>
  )
}
