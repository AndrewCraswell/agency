import { Badge, Body1Strong, Card, CardHeader, makeStyles, tokens } from "@fluentui/react-components"
import { PlugConnectedRegular } from "@fluentui/react-icons"
import type { IntegrationSettings } from "@/services/api"
import { formatIdentifierLabel } from "@/utils/formatIdentifierLabel"

const useStyles = makeStyles({
  catalog: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
    gap: tokens.spacingHorizontalL
  },
  card: { padding: tokens.spacingHorizontalL, borderRadius: tokens.borderRadiusMedium },
  body: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM },
  capabilities: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalXS }
})

type Props = {
  catalog: IntegrationSettings["catalog"]
  connections: IntegrationSettings["connections"]
}

export function IntegrationCatalog({ catalog, connections }: Props) {
  const styles = useStyles()
  return (
    <div className={styles.catalog}>
      {catalog.map((item) => {
        const connected = connections.some(
          (connection) => connection.provider === item.provider && connection.status !== "disconnected"
        )
        return (
          <Card key={item.provider} className={styles.card}>
            <CardHeader
              image={<PlugConnectedRegular fontSize={24} />}
              header={<Body1Strong>{item.name}</Body1Strong>}
              description={item.description}
              action={<Badge appearance="tint">{connected ? "Configured" : "Available"}</Badge>}
            />
            <div className={styles.body}>
              <div className={styles.capabilities} aria-label={`${item.name} capabilities`}>
                {item.capabilities.map((capability) => (
                  <Badge key={capability} appearance="outline">
                    {formatIdentifierLabel(capability)}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
