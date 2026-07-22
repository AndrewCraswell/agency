import { reactRouter } from "@react-router/dev/vite"
import babel from "@rolldown/plugin-babel"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig, type UserConfig } from "vite"

if (process.env.HOST && (!process.env.SHOPIFY_APP_URL || process.env.SHOPIFY_APP_URL === process.env.HOST)) {
  process.env.SHOPIFY_APP_URL = process.env.HOST
  delete process.env.HOST
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost").hostname
const hmr =
  host === "localhost"
    ? { protocol: "ws", host: "localhost", port: 64999, clientPort: 64999 }
    : { protocol: "wss", host, port: Number(process.env.FRONTEND_PORT) || 8002, clientPort: 443 }

export default defineConfig({
  server: {
    allowedHosts: [host],
    cors: { preflightContinue: true },
    port: Number(process.env.PORT || 3000),
    hmr,
    fs: { allow: ["app", "node_modules"] }
  },
  plugins: [reactRouter(), react(), babel({ presets: [reactCompilerPreset({ target: "19" })] })],
  resolve: { tsconfigPaths: true },
  build: { assetsInlineLimit: 0 },
  optimizeDeps: { include: ["@shopify/app-bridge-react"] }
}) satisfies UserConfig
