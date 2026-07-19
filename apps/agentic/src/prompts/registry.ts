import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { z } from "zod"
import { PromptVersionSchema, SPECIALIZED_CONTRACT_SCHEMA_VERSION } from "../contracts/specialized"

const RegisteredPromptRoleSchema = z.enum(["scrum_master", "coder"])
const RegisteredPromptVersionSchema = z.literal("v1")

const ResolvedPromptSchema = PromptVersionSchema.extend({
  content: z
    .string()
    .min(1)
    .refine((content) => content.trim().length > 0, "Prompt content cannot be blank")
})

function promptUrl(role: z.infer<typeof RegisteredPromptRoleSchema>, version: "v1"): URL {
  if (role === "scrum_master") {
    return new URL(`../../prompts/scrum-master/${version}.md`, import.meta.url)
  }
  return new URL(`../../prompts/coder/${version}.md`, import.meta.url)
}

export async function resolvePrompt(roleInput: unknown, versionInput: unknown = "v1") {
  const role = RegisteredPromptRoleSchema.parse(roleInput)
  const version = RegisteredPromptVersionSchema.parse(versionInput)
  const content = await readFile(promptUrl(role, version), "utf8")
  return ResolvedPromptSchema.parse({
    schemaVersion: SPECIALIZED_CONTRACT_SCHEMA_VERSION,
    role,
    version,
    sha256: createHash("sha256").update(content).digest("hex"),
    content
  })
}
