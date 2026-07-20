import { Caption1, Spinner, makeStyles, tokens } from "@fluentui/react-components"

const useStyles = makeStyles({
  status: {
    minHeight: "20px",
    display: "inline-flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground2
  }
})

export function AsyncStatus({ message, pending = false }: { message: string; pending?: boolean }) {
  const styles = useStyles()
  return (
    <output className={styles.status} aria-live="polite" aria-atomic="true">
      {pending ? <Spinner size="extra-tiny" aria-hidden="true" /> : null}
      <Caption1>{message}</Caption1>
    </output>
  )
}
