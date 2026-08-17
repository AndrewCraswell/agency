import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["evals/**/*.test.mjs", "src/**/*.test.ts"]
  }
})
