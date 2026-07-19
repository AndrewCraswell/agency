import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

/**
 * Type-safe, validated environment variables.
 *
 * Only `VITE_`-prefixed variables are exposed to the client bundle. Always read
 * configuration through this module rather than `import.meta.env` directly, so
 * every value is validated once at the boundary.
 */
export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_API_BASE_URL: z.string().url().default("http://localhost:3000"),
    VITE_LANGSMITH_BASE_URL: z.string().url().default("https://smith.langchain.com"),
    VITE_LANGSMITH_WORKSPACE_ID: z.string().trim().min(1).default("38b74c4b-cae0-450b-bd68-dcaac6fb58a7"),
    VITE_LANGSMITH_PROJECT_ID: z.string().trim().min(1).default("bdc8ae06-8403-46e5-be23-16ef49736b2f")
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true
})
