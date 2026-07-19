import { z } from "zod"
import { OPENHANDS_AGENT_SERVER_IMAGE } from "../openhands/profiles"

const ProviderVersionSchema = z
  .object({
    provider: z.string().trim().min(1),
    version: z.string().trim().min(1)
  })
  .strict()

const PhaseDecisionSchema = z
  .object({
    code: z.string().trim().min(1),
    evidence: z.string().trim().min(1),
    status: z.literal("deferred")
  })
  .strict()

export const RuntimeSelectionSchema = z
  .object({
    agentRuntime: ProviderVersionSchema,
    decisions: z
      .object({
        phase8: PhaseDecisionSchema,
        phase9: PhaseDecisionSchema
      })
      .strict(),
    orchestrator: ProviderVersionSchema,
    selectionVersion: z.literal(1),
    workspace: ProviderVersionSchema
  })
  .strict()

export type RuntimeSelection = z.infer<typeof RuntimeSelectionSchema>

export const ACTIVE_RUNTIME_SELECTION = RuntimeSelectionSchema.parse({
  agentRuntime: {
    provider: "openhands",
    version: OPENHANDS_AGENT_SERVER_IMAGE
  },
  decisions: {
    phase8: {
      code: "no-approved-microsoft-candidate-or-parity-evidence",
      evidence:
        "docs/agent-platform/phase-8-microsoft-hosted-agent-runtime.md#41-capability-and-responsibility-assessment",
      status: "deferred"
    },
    phase9: {
      code: "no-qualifying-azure-workspace-entry-driver",
      evidence: "docs/agent-platform/phase-9-azure-native-workspaces.md#2-entry-gate",
      status: "deferred"
    }
  },
  orchestrator: {
    provider: "langgraph",
    version: "1.4.7"
  },
  selectionVersion: 1,
  workspace: {
    provider: "daytona",
    version: "0.196.0"
  }
})

function requireSupportedProvider(
  requested: string | undefined,
  supported: string,
  decision: z.infer<typeof PhaseDecisionSchema>
): void {
  if (requested === undefined || requested === supported) return
  throw new Error(`Unsupported runtime provider ${requested}; ${decision.code} (${decision.evidence})`)
}

export function runtimeSelectionFromEnvironment(environment: NodeJS.ProcessEnv): RuntimeSelection {
  requireSupportedProvider(
    environment.ORCHESTRATOR_PROVIDER,
    ACTIVE_RUNTIME_SELECTION.orchestrator.provider,
    ACTIVE_RUNTIME_SELECTION.decisions.phase8
  )
  requireSupportedProvider(
    environment.AGENT_RUNTIME_PROVIDER,
    ACTIVE_RUNTIME_SELECTION.agentRuntime.provider,
    ACTIVE_RUNTIME_SELECTION.decisions.phase8
  )
  requireSupportedProvider(
    environment.WORKSPACE_PROVIDER,
    ACTIVE_RUNTIME_SELECTION.workspace.provider,
    ACTIVE_RUNTIME_SELECTION.decisions.phase9
  )
  return ACTIVE_RUNTIME_SELECTION
}
