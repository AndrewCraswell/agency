import { ModalManager } from "@1js/fluentui-modal-manager"
import {
  Body1,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Radio,
  RadioGroup,
  Spinner,
  Subtitle2,
  Title1,
  makeStyles,
  mergeClasses,
  tokens
} from "@fluentui/react-components"
import { AddRegular, ArrowSyncRegular } from "@fluentui/react-icons"
import Nango, { type ConnectUIEvent } from "@nangohq/frontend"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { showAppToast, useAppToast } from "@/hooks/useAppToast"
import {
  completeIntegrationAuthorization,
  disconnectIntegration,
  getIntegrationDisconnectImpact,
  getIntegrationSettings,
  reconcileIntegrations,
  refreshIntegrationConnection,
  startIntegrationAuthorization,
  startIntegrationReconnect,
  type IntegrationConnection,
  type IntegrationProvider,
  type IntegrationSettings
} from "@/services/api"
import { IntegrationCatalog } from "./integrations/IntegrationCatalog"
import { IntegrationConnectionCard } from "./integrations/IntegrationConnectionCard"

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
  headingActions: { display: "flex", gap: tokens.spacingHorizontalS, flexWrap: "wrap", justifyContent: "flex-end" },
  section: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  connections: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  empty: {
    padding: tokens.spacingVerticalXXL,
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
    color: tokens.colorNeutralForeground3
  },
  busy: { minHeight: "320px", display: "grid", placeItems: "center" },
  mobilePage: { "@media (max-width: 720px)": { padding: tokens.spacingHorizontalL } },
  impactList: { marginBottom: 0 },
  dialogContent: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  providerOptions: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalS },
  providerOption: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
    padding: tokens.spacingHorizontalM,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium
  },
  providerDescription: { marginInlineStart: "28px", color: tokens.colorNeutralForeground2 }
})

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The integration operation failed"
}

function providerName(provider: IntegrationProvider): string {
  return provider === "github" ? "GitHub" : "Linear"
}

export function IntegrationsPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const search = useSearch({ from: "/integrations" })
  const dispatchToast = useAppToast()
  const [settings, setSettings] = useState<IntegrationSettings>()
  const [loading, setLoading] = useState(true)
  const [activeOperation, setActiveOperation] = useState<string>()
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<IntegrationProvider>()

  async function load(): Promise<void> {
    try {
      setSettings(await getIntegrationSettings())
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        id: "integrations-load",
        title: "Integrations unavailable",
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
            id: "integrations-load",
            title: "Integrations unavailable",
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
        body: `${providerName(provider)} is ready to use.`,
        timeoutMs: 5000
      })
      await load()
      if (provider === "github" && search.returnTo === "workflow-create") {
        await navigate({ to: "/workflows", search: { create: true, name: search.workflowName }, replace: true })
      }
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
      showAppToast(dispatchToast, { intent: "error", title: "Connect window unavailable", body: errorMessage(error) })
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
    setActiveOperation(connection.connectionId)
    try {
      const impact = await getIntegrationDisconnectImpact(connection.connectionId)
      const confirmed = await ModalManager.openConfirm({
        title: `Disconnect ${providerName(connection.provider)}?`,
        children:
          impact.affectedWorkflowCount === 0 ? (
            "No workflows currently use this connection. Provider events and resources will no longer be available."
          ) : (
            <div>
              <Body1>
                {impact.affectedWorkflowCount} {impact.affectedWorkflowCount === 1 ? "workflow uses" : "workflows use"}{" "}
                this connection and will lose provider access.
              </Body1>
              <ul className={styles.impactList}>
                {impact.workflows.map((workflow) => (
                  <li key={workflow.workflowId}>{workflow.name}</li>
                ))}
              </ul>
            </div>
          ),
        labels: { confirm: "Disconnect", cancel: "Keep connected" },
        confirmAppearance: "primary"
      })
      if (!confirmed) {
        return
      }
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
        title: "Connections checked",
        body: `${result.checked} ${result.checked === 1 ? "connection" : "connections"} checked.`,
        timeoutMs: 4000
      })
    } catch (error) {
      showAppToast(dispatchToast, {
        intent: "error",
        title: "Connections couldn't be checked",
        body: errorMessage(error)
      })
    } finally {
      setActiveOperation(undefined)
    }
  }

  if (loading) {
    return (
      <main className={styles.busy}>
        <Spinner label="Loading integrations" />
      </main>
    )
  }

  const catalog = settings?.catalog ?? []
  const connections = settings?.connections ?? []
  return (
    <main className={mergeClasses(styles.page, styles.mobilePage)}>
      <div className={styles.heading}>
        <div className={styles.headingText}>
          <Title1 as="h1">Integrations</Title1>
          <Body1>Authorize providers, review connection health, and manage discovered resources.</Body1>
        </div>
        <div className={styles.headingActions}>
          <Dialog open={addDialogOpen} onOpenChange={(_, data) => setAddDialogOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
              <Button appearance="primary" icon={<AddRegular />} onClick={() => setSelectedProvider(undefined)}>
                Add integration
              </Button>
            </DialogTrigger>
            <DialogSurface aria-describedby={undefined}>
              <DialogBody>
                <DialogTitle>Add integration</DialogTitle>
                <DialogContent className={styles.dialogContent}>
                  <Body1>Select a provider to connect to Agency.</Body1>
                  <RadioGroup
                    className={styles.providerOptions}
                    value={selectedProvider ?? ""}
                    onChange={(_, data) => {
                      const provider = catalog.find((item) => item.provider === data.value)?.provider
                      setSelectedProvider(provider)
                    }}
                    aria-label="Provider"
                  >
                    {catalog.map((item) => (
                      <div className={styles.providerOption} key={item.provider}>
                        <Radio value={item.provider} label={item.name} />
                        <Body1 className={styles.providerDescription}>{item.description}</Body1>
                      </div>
                    ))}
                  </RadioGroup>
                </DialogContent>
                <DialogActions>
                  <DialogTrigger disableButtonEnhancement action="close">
                    <Button appearance="secondary">Cancel</Button>
                  </DialogTrigger>
                  <Button
                    appearance="primary"
                    disabled={selectedProvider === undefined || activeOperation !== undefined}
                    onClick={() => {
                      if (selectedProvider !== undefined) {
                        setAddDialogOpen(false)
                        void connect(selectedProvider)
                      }
                    }}
                  >
                    Continue
                  </Button>
                </DialogActions>
              </DialogBody>
            </DialogSurface>
          </Dialog>
          <Button
            icon={<ArrowSyncRegular />}
            onClick={() => void reconcile()}
            disabled={activeOperation === "reconcile"}
          >
            Check connections
          </Button>
        </div>
      </div>

      <section className={styles.section} aria-labelledby="available-integrations">
        <Subtitle2 as="h2" id="available-integrations">
          Available integrations
        </Subtitle2>
        <IntegrationCatalog catalog={catalog} connections={connections} />
      </section>

      <section className={styles.section} aria-labelledby="connections">
        <Subtitle2 as="h2" id="connections">
          Connections
        </Subtitle2>
        {connections.length === 0 ? (
          <div className={styles.empty}>No provider connections have been added.</div>
        ) : (
          <div className={styles.connections}>
            {connections.map((connection) => (
              <IntegrationConnectionCard
                key={connection.connectionId}
                connection={connection}
                busy={activeOperation === connection.connectionId}
                onDisconnect={(value) => void disconnect(value)}
                onReconnect={(value) => void reconnect(value)}
                onRefresh={(connectionId) => void refresh(connectionId)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
