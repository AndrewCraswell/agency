import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "app/**/*.test.ts", "scripts/**/*.test.ts", "scripts/**/*.test.mjs", "proxy.test.ts"]
  }
})
