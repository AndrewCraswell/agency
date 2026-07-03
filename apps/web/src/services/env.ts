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
    VITE_API_BASE_URL: z.string().url().default("http://localhost:3000")
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true
})
