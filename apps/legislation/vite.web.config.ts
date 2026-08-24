import { fileURLToPath } from "node:url"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const appRoot = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  root: appRoot,
  plugins: [tanstackStart({ srcDirectory: "src/web" }), viteReact()],
  server: {
    port: 3100
  }
})
