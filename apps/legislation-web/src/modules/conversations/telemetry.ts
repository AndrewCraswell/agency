import { flushNodeTelemetry, registerNodeTelemetry } from "../../services/sentry/nodeTelemetry"
import { redactCredentials } from "./redactCredentials"

export function registerChatTelemetry(environment: NodeJS.ProcessEnv) {
  return registerNodeTelemetry(environment, ({ data }) => redactCredentials(data))
}

export async function flushChatTelemetry() {
  await flushNodeTelemetry()
}
