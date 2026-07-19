export const OPENHANDS_AGENT_SERVER_IMAGE =
  "ghcr.io/openhands/agent-server@sha256:6301c75380733e83c7291a9a258de5fc04a99d940894db7b157e845a8cc03dcc" as const
export const OPENHANDS_AGENT_SERVER_PORT = 8000 as const

export interface AgentServerSecrets {
  sessionApiKey: string
  encryptionKey: string
}

export function createAgentServerEnvironment(secrets: AgentServerSecrets): Record<string, string> {
  return {
    OH_SESSION_API_KEYS_0: secrets.sessionApiKey,
    OH_SECRET_KEY: secrets.encryptionKey,
    OH_ENABLE_VNC: "false",
    OH_ENABLE_VSCODE: "false",
    OH_PRELOAD_TOOLS: "false",
    OH_WEBHOOKS: "[]"
  }
}

export interface OpenHandsModelProfile {
  name: string
  model: string
  baseUrl: string
  reasoningEffort: "low" | "medium" | "high" | "xhigh" | "none"
  usageId: string
}

export const createCoderProfile = (usageId: string): OpenHandsModelProfile => ({
  name: "coder",
  model: "openrouter/openai/gpt-5.6-terra",
  baseUrl: "https://openrouter.ai/api/v1",
  reasoningEffort: "medium",
  usageId
})

export const createReviewerProfile = (usageId: string): OpenHandsModelProfile => ({
  name: "reviewer",
  model: "openrouter/openai/gpt-5.6",
  baseUrl: "https://openrouter.ai/api/v1",
  reasoningEffort: "high",
  usageId
})
