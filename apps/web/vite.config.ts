import babel from "@rolldown/plugin-babel"
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { visualizer } from "rollup-plugin-visualizer"
import { defineConfig } from "vitest/config"

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset({ target: "19" })] }),
    // `pnpm --filter web analyze` (vite build --mode analyze) writes an
    // interactive treemap of the bundle (gzip + brotli sizes) to
    // dist/stats.html and opens it.
    mode === "analyze"
      ? visualizer({ filename: "dist/stats.html", template: "treemap", gzipSize: true, brotliSize: true, open: true })
      : false
  ],
  resolve: {
    tsconfigPaths: true
  },
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Don't let generated output (e.g. Vitest coverage reports) trigger HMR
      // reloads while the dev server and tests run at the same time.
      ignored: ["**/coverage/**", "**/storybook-static/**", "**/dist/**", "**/.turbo/**"]
    }
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.stories.{ts,tsx}",
        "src/tests/**",
        "src/main.tsx",
        "src/router.tsx",
        "src/routes/RootLayout.tsx",
        "src/vite-env.d.ts"
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 70,
        functions: 75
      }
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          setupFiles: ["./src/tests/setup.ts"],
          css: true
        }
      },
      {
        extends: true,
        plugins: [storybookTest({ configDir: ".storybook" })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }]
          }
        }
      }
    ]
  }
}))
