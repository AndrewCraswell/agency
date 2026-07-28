import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./app/tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["app/components/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.test.{ts,tsx}",
        "app/**/*.stories.{ts,tsx}",
        "app/components/tiptap-extension/**",
        "app/components/tiptap-icons/**",
        "app/components/tiptap-node/**",
        "app/components/tiptap-templates/**",
        "app/components/tiptap-ui/**",
        "app/components/tiptap-ui-primitive/**"
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80
      }
    }
  }
})
