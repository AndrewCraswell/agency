import { z } from "zod"

export const AgentIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)

export const AgentDefinitionSchema = z
  .object({
    id: AgentIdSchema,
    name: z.string().trim().min(1),
    role: z.enum(["scrum_master", "engineer", "reviewer"]),
    description: z.string().trim().min(1)
  })
  .strict()

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>

export const agents = z.array(AgentDefinitionSchema).parse([
  {
    id: "scrum-master",
    name: "Scrum master",
    role: "scrum_master",
    description: "Reviews eligible work and assigns the best bounded task to an available engineer."
  },
  {
    id: "engineer",
    name: "Engineer",
    role: "engineer",
    description: "Implements, validates, and repairs one assigned task at a time."
  },
  {
    id: "reviewer",
    name: "Reviewer",
    role: "reviewer",
    description: "Independently reviews one exact candidate commit in a fresh workspace."
  }
])

export function engineeringAgent(agentId: string): AgentDefinition | null {
  return agents.find((agent) => agent.id === agentId && agent.role === "engineer") ?? null
}
