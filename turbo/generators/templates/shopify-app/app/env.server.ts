import { createEnv } from "@t3-oss/env-core"
import { z } from "zod"

export const env = createEnv({
  server: {
    SHOPIFY_API_KEY: z.string().min(1),
    SHOPIFY_API_SECRET: z.string().min(1),
    SHOPIFY_APP_URL: z.url(),
    SCOPES: z.string().optional(),
    SHOP_CUSTOM_DOMAIN: z.string().optional()
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true
})
