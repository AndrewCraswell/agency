import { createMcpHandler, McpServer } from "@modelcontextprotocol/server"
import { errorContext, type Logger } from "@repo/legislation-core/observability/logger"
import type { Telemetry } from "@repo/legislation-core/observability/telemetry"
import { createLegislationResearchTools, type LegislationQueryApi } from "@repo/legislation-core/research/tools"

export function createLegislationMcpHandler(service: LegislationQueryApi, logger: Logger, telemetry?: Telemetry) {
  return createMcpHandler(
    () => {
      const server = new McpServer({ name: "legislation", version: "0.1.0" }, { capabilities: { tools: {} } })
      for (const definition of createLegislationResearchTools(service, logger, telemetry)) {
        server.registerTool(
          definition.name,
          {
            description: definition.description,
            inputSchema: definition.inputSchema,
            outputSchema: definition.outputSchema,
            ...(definition.annotations ? { annotations: definition.annotations } : {})
          },
          definition.execute
        )
      }
      return server
    },
    {
      legacy: "stateless",
      onerror: (error) => logger.error("MCP protocol error", errorContext(error)),
      responseMode: "auto"
    }
  )
}
