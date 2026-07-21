import { defineConfig } from "drizzle-kit"

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/persistence/schema.ts",
  out: "./drizzle/migrations",
  strict: true,
  verbose: true
})
