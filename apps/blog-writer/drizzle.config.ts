import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./app/persistence/schema.server.ts",
  out: "./drizzle/migrations",
  strict: true,
  verbose: true
})
