import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "app/**/*.test.ts", "scripts/**/*.test.ts", "proxy.test.ts"]
  }
})
