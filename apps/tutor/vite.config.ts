import babel from "@rolldown/plugin-babel"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset({ target: "19" })] })],
  resolve: {
    dedupe: ["react", "react-dom"],
    tsconfigPaths: true
  },
  server: {
    port: 5180,
    strictPort: true,
    watch: {
      ignored: ["**/coverage/**", "**/dist/**", "**/.turbo/**"]
    }
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/tests/setup.ts"],
    css: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/tests/**", "src/main.tsx", "src/vite-env.d.ts", "src/**/*.styles.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 70,
        functions: 75
      }
    }
  }
})
