import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

const simulatorDirectory = dirname(fileURLToPath(import.meta.url))
const scoringDirectory = resolve(simulatorDirectory, "..")
const simulatorApiPort = process.env.SIMULATOR_API_PORT ?? "4178"

export default defineConfig({
  root: simulatorDirectory,
  plugins: [react(), babel({ presets: [reactCompilerPreset({ target: "19" })] }), tailwindcss()],
  resolve: {
    alias: { "@": resolve(simulatorDirectory, "src") },
    dedupe: ["react", "react-dom"]
  },
  build: {
    emptyOutDir: true,
    outDir: resolve(scoringDirectory, "dist/simulator")
  },
  server: {
    port: 5174,
    proxy: {
      "/api": `http://127.0.0.1:${simulatorApiPort}`
    },
    strictPort: true
  },
  test: {
    coverage: {
      exclude: ["src/components/ui/**", "src/main.tsx"],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "text-summary", "html", "lcov", "json-summary"],
      reportsDirectory: resolve(scoringDirectory, "coverage/simulator"),
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80
      }
    },
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"]
  }
})
