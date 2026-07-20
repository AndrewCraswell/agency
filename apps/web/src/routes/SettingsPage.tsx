import { ModalManager } from "@1js/fluentui-modal-manager"
import {
  Badge,
  Body1,
  Body1Strong,
  Button,
  Card,
  CardHeader,
  makeStyles,
  mergeClasses,
  Spinner,
  Subtitle2,
  Title1,
  tokens
} from "@fluentui/react-components"
import {
  AddRegular,
  ArrowSyncRegular,
  CheckmarkCircleRegular,
  DeleteRegular,
  DismissCircleRegular,
  PlugConnectedRegular,
  WarningRegular
} from "@fluentui/react-icons"
import Nango, { type ConnectUIEvent } from "@nangohq/frontend"
import { useEffect, useState } from "react"
import { showAppToast, useAppToast } from "@/hooks/useAppToast"
import {
  completeIntegrationAuthorization,
  disconnectIntegration,
  getIntegrationSettings,
  reconcileIntegrations,
  refreshIntegrationConnection,
  startIntegrationAuthorization,
  startIntegrationReconnect,
  type IntegrationConnection,
  type IntegrationProvider,
  type IntegrationSettings
} from "@/services/api"

const useStyles = makeStyles({
  page: {
    width: "100%",
    maxWidth: "1120px",
    margin: "0 auto",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXL
  },
  heading: { display: "flex", justifyContent: "space-between", alignItems: "end", gap: tokens.spacingHorizontalL },
  headingText: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXS },
  catalog: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 310px), 1fr))",
    gap: tokens.spacingHorizontalL
  },
  card: { padding: tokens.spacingHorizontalL, borderRadius: tokens.borderRadiusMedium },
  cardBody: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  cardActions: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalS, alignItems: "center" },
  capabilities: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  connection: {
    display: "grid",
    gridTemplateColumns: "minmax(180px, 0.8fr) minmax(240px, 1.4fr) auto",
    alignItems: "center",
    gap: tokens.spacingHorizontalL
  },
  identity: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXXS },
  resource: { minWidth: "220px" },
  resourceList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    margin: 0,
    padding: 0,
    listStyleType: "none"
  },
  empty: {
    padding: tokens.spacingVerticalXXL,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
    color: tokens.colorNeutralForeground3
  },
  busy: { minHeight: "320px", display: "grid", placeItems: "center" },
  disconnected: { opacity: 0.72 },
  mobileConnection: {
    "@media (max-width: 720px)": { gridTemplateColumns: "1fr", alignItems: "stretch" }
  },
  mobilePage: { "@media (max-width: 720px)": { padding: tokens.spacingHorizontalL } }
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The integration operation failed"
}

function statusBadge(connection: IntegrationConnection) {
  if (connection.status === "connected") {
    return (
      <Badge appearance="tint" color="success" icon={<CheckmarkCircleRegular />}>
        Connected
      </Badge>
    )
  }
  if (connection.status === "degraded") {
    return (
      <Badge appearance="tint" color="warning" icon={<WarningRegular />}>
        Needs attention
      </Badge>
    )
  }
  return (
    <Badge appearance="tint" color="danger" icon={<DismissCircleRegular />}>
      Disconnected
    </Badge>
  )
}

export function SettingsPage() {
  const styles = useStyles()
  const dispatchToast = useAppToast()
  const [settings, setSettings] = useState<IntegrationSettings>()
  const [loading, setLoading] = useState(true)
  const [activeOperation, setActiveOperation] = useState<string>()

  async function load(): Promise<void> {
    try {
      setSettings(await getIntegrationSettings())
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        id: "settings-load",
        title: "Settings unavailable",
        body: errorMessage(error)
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void getIntegrationSettings()
      .then((value) => {
        if (active) {
          setSettings(value)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          showAppToast(dispatchToast, {
            intent: "error",
            id: "settings-load",
            title: "Settings unavailable",
            body: errorMessage(error)
          })
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [dispatchToast])

  async function finishConnect(provider: IntegrationProvider, event: ConnectUIEvent): Promise<void> {
    if (event.type === "error") {
      showAppToast(dispatchToast, { intent: "error", title: "Connection failed", body: event.payload.errorMessage })
      setActiveOperation(undefined)
      return
    }
    if (event.type === "close") {
      setActiveOperation(undefined)
      return
    }
    if (event.type !== "connect") {
      return
    }
    try {
      await completeIntegrationAuthorization(provider, event.payload.providerConfigKey, event.payload.connectionId)
      showAppToast(dispatchToast, {
        intent: "success",
        title: "Integration connected",
        body: `${provider} is ready to use.`,
        timeoutMs: 5000
      })
      await load()
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Connection could not be saved",
        body: errorMessage(error)
      })
    } finally {
      setActiveOperation(undefined)
    }
  }

  function openConnectUI(provider: IntegrationProvider, token: string): void {
    const nango = new Nango({ connectSessionToken: token })
    const connectUi = nango.openConnectUI({
      detectClosedAuthWindow: true,
      onEvent: async (event) => {
        await finishConnect(provider, event)
        if (event.type === "connect" || event.type === "close" || event.type === "error") {
          connectUi.close()
        }
      }
    })
    connectUi.open()
  }

  async function connect(provider: IntegrationProvider): Promise<void> {
    setActiveOperation(`connect-${provider}`)
    try {
      const session = await startIntegrationAuthorization(provider)
      openConnectUI(provider, session.token)
    } catch (error) {
      setActiveOperation(undefined)
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Connect window unavailable",
        body: errorMessage(error)
      })
    }
  }

  async function reconnect(connection: IntegrationConnection): Promise<void> {
    setActiveOperation(connection.connectionId)
    try {
      const session = await startIntegrationReconnect(connection.connectionId)
      openConnectUI(connection.provider, session.token)
    } catch (error) {
      setActiveOperation(undefined)
      showAppToast(dispatchToast, { intent: "error", title: "Reconnect unavailable", body: errorMessage(error) })
    }
  }

  async function refresh(connectionId: string): Promise<void> {
    setActiveOperation(connectionId)
    try {
      await refreshIntegrationConnection(connectionId)
      await load()
      showAppToast(dispatchToast, { intent: "success", title: "Connection refreshed", timeoutMs: 3500 })
    } catch (error) {
      showAppToast(dispatchToast, { intent: "error", title: "Refresh failed", body: errorMessage(error) })
    } finally {
      setActiveOperation(undefined)
    }
  }

  async function disconnect(connection: IntegrationConnection): Promise<void> {
    const confirmed = await ModalManager.openConfirm({
      title: `Disconnect ${connection.provider}?`,
      children: "Workflows using this connection will stop receiving resources and provider events.",
      labels: { confirm: "Disconnect", cancel: "Keep connected" },
      confirmAppearance: "primary"
    })
    if (!confirmed) {
      return
    }
    setActiveOperation(connection.connectionId)
    try {
      await disconnectIntegration(connection.connectionId)
      await load()
      showAppToast(dispatchToast, { intent: "success", title: "Integration disconnected", timeoutMs: 3500 })
    } catch (error) {
      showAppToast(dispatchToast, { intent: "error", title: "Disconnect failed", body: errorMessage(error) })
    } finally {
      setActiveOperation(undefined)
    }
  }

  async function reconcile(): Promise<void> {
    setActiveOperation("reconcile")
    try {
      const result = await reconcileIntegrations()
      await load()
      showAppToast(dispatchToast, {
        intent: "success",
        title: "Connections reconciled",
        body: `${result.checked} connection records checked.`,
        timeoutMs: 4000
      })
    } catch (error) {
      showAppToast(dispatchToast, { intent: "error", title: "Reconciliation failed", body: errorMessage(error) })
    } finally {
      setActiveOperation(undefined)
    }
  }

  if (loading) {
    return (
      <main className={styles.busy}>
        <Spinner label="Loading integration settings" />
      </main>
    )
  }

  return (
    <main className={mergeClasses(styles.page, styles.mobilePage)}>
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <Title1 as="h1">Integrations</Title1>
          <Body1>Authorize providers, discover available resources, and monitor connection health.</Body1>
        </div>
        <Button icon={<ArrowSyncRegular />} onClick={() => void reconcile()} disabled={activeOperation !== undefined}>
          Reconcile
        </Button>
      </div>

      <section className={styles.section} aria-labelledby="available-integrations">
        <Subtitle2 as="h2" id="available-integrations">
          Available integrations
        </Subtitle2>
        <div className={styles.catalog}>
          {settings?.catalog.map((item) => {
            const connected = settings.connections.some(
              (connection) => connection.provider === item.provider && connection.status !== "disconnected"
            )
            return (
              <Card key={item.provider} className={styles.card}>
                <CardHeader
                  image={<PlugConnectedRegular fontSize={24} />}
                  header={<Body1Strong>{item.name}</Body1Strong>}
                  description={item.description}
                />
                <div className={styles.cardBody}>
                  <div className={styles.capabilities}>
                    {item.capabilities.map((capability) => (
                      <Badge key={capability} appearance="outline">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                  <Button
                    appearance={connected ? "secondary" : "primary"}
                    icon={<AddRegular />}
                    disabled={activeOperation !== undefined}
                    onClick={() => void connect(item.provider)}
                  >
                    {connected ? "Add another connection" : `Connect ${item.name}`}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="connections">
        <Subtitle2 as="h2" id="connections">
          Connections
        </Subtitle2>
        {settings?.connections.length === 0 ? (
          <div className={styles.empty}>No provider connections have been registered with Agency.</div>
        ) : (
          settings?.connections.map((connection) => {
            const busy = activeOperation === connection.connectionId
            return (
              <Card
                key={connection.connectionId}
                className={mergeClasses(
                  styles.card,
                  styles.connection,
                  styles.mobileConnection,
                  connection.status === "disconnected" && styles.disconnected
                )}
              >
                <div className={styles.identity}>
                  <Body1Strong>{connection.provider === "github" ? "GitHub" : "Linear"}</Body1Strong>
                  <Body1>{connection.displayName ?? "Provider connection"}</Body1>
                  {statusBadge(connection)}
                </div>
                <div className={styles.resource}>
                  {connection.resources.length === 0 ? (
                    <Body1>
                      {connection.status === "disconnected"
                        ? "Resources unavailable while disconnected"
                        : "No resources discovered"}
                    </Body1>
                  ) : (
                    <ul
                      className={styles.resourceList}
                      aria-label={connection.provider === "github" ? "Discovered repositories" : "Discovered teams"}
                    >
                      {connection.resources.map((resource) => (
                        <li key={resource.externalId}>
                          {resource.name}
                          {resource.stale ? " (stale)" : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                  {connection.errorCode ? <Body1>{connection.errorCode.replaceAll("_", " ")}</Body1> : null}
                </div>
                <div className={styles.cardActions}>
                  {busy ? <Spinner size="tiny" /> : null}
                  {connection.status === "disconnected" || connection.status === "degraded" ? (
                    <Button
                      icon={<PlugConnectedRegular />}
                      onClick={() => void reconnect(connection)}
                      disabled={activeOperation !== undefined}
                    >
                      Reconnect
                    </Button>
                  ) : null}
                  <Button
                    icon={<ArrowSyncRegular />}
                    onClick={() => void refresh(connection.connectionId)}
                    disabled={activeOperation !== undefined || connection.status === "disconnected"}
                  >
                    Refresh
                  </Button>
                  <Button
                    icon={<DeleteRegular />}
                    onClick={() => void disconnect(connection)}
                    disabled={activeOperation !== undefined || connection.status === "disconnected"}
                  >
                    Disconnect
                  </Button>
                </div>
              </Card>
            )
          })
        )}
      </section>
    </main>
  )
}
