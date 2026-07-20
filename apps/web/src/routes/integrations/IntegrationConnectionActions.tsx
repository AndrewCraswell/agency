import { Button, Spinner, makeStyles, tokens } from "@fluentui/react-components"
import { ArrowSyncRegular, DeleteRegular, PlugConnectedRegular } from "@fluentui/react-icons"
import type { IntegrationConnection } from "@/services/api"

const useStyles = makeStyles({
  actions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" }
})

type Props = {
  connection: IntegrationConnection
  busy: boolean
  onDisconnect: (connection: IntegrationConnection) => void
  onReconnect: (connection: IntegrationConnection) => void
  onRefresh: (connectionId: string) => void
}

export function IntegrationConnectionActions({ connection, busy, onDisconnect, onReconnect, onRefresh }: Props) {
  const styles = useStyles()
  return (
    <div className={styles.actions}>
      {busy ? <Spinner size="tiny" label="Updating connection" /> : null}
      {connection.status === "disconnected" || connection.status === "degraded" ? (
        <Button icon={<PlugConnectedRegular />} onClick={() => onReconnect(connection)} disabled={busy}>
          Reconnect
        </Button>
      ) : null}
      <Button
        icon={<ArrowSyncRegular />}
        onClick={() => onRefresh(connection.connectionId)}
        disabled={busy || connection.status === "disconnected"}
      >
        Refresh
      </Button>
      <Button
        icon={<DeleteRegular />}
        onClick={() => onDisconnect(connection)}
        disabled={busy || connection.status === "disconnected"}
      >
        Disconnect
      </Button>
    </div>
  )
}
