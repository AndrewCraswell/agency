import { Nango } from "@nangohq/node"
import { z } from "zod"

const GitHubAppCredentialsSchema = z.object({
  type: z.literal("APP"),
  access_token: z.string().min(1)
})

type NangoGitHubClient = {
  listConnections(input: { integrationId: string; limit: number }): Promise<{
    connections: Array<{ connection_id: string }>
  }>
  getToken(integrationId: string, connectionId: string): Promise<unknown>
}

export type NangoGitHubTokenProviderOptions = {
  apiKey: string
  integrationId?: string
  connectionId?: string
}

export function createNangoGitHubTokenProvider(
  options: NangoGitHubTokenProviderOptions,
  client: NangoGitHubClient = new Nango({ apiKey: options.apiKey })
) {
  const integrationId = options.integrationId ?? "github-app"
  let connectionId = options.connectionId

  return async (): Promise<string> => {
    if (connectionId === undefined) {
      const result = await client.listConnections({ integrationId, limit: 2 })
      if (result.connections.length !== 1) {
        throw new Error(
          `Expected exactly one Nango connection for integration ${integrationId}, found ${result.connections.length}`
        )
      }
      connectionId = result.connections[0]?.connection_id
    }

    if (connectionId === undefined) {
      throw new Error(`Nango connection for integration ${integrationId} has no connection ID`)
    }

    const credentials = GitHubAppCredentialsSchema.parse(await client.getToken(integrationId, connectionId))
    return credentials.access_token
  }
}
