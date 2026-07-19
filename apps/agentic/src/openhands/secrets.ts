import { createHmac } from "node:crypto"
import { z } from "zod"
import type { AgentServerSecrets } from "./profiles"

const WorkspaceSecretKeySchema = z.string().min(32)
const SecretScopeSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)

export function deriveAgentServerSecrets(masterSecret: string, runId: string, scope: string): AgentServerSecrets {
  const key = WorkspaceSecretKeySchema.parse(masterSecret)
  const identity = `${z.uuid().parse(runId)}:${SecretScopeSchema.parse(scope)}`
  return {
    sessionApiKey: createHmac("sha256", key).update(`session:${identity}`).digest("hex"),
    encryptionKey: createHmac("sha256", key).update(`encryption:${identity}`).digest("hex")
  }
}
