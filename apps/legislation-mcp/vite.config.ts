import { defineConfig } from "vite"

export default defineConfig({
  publicDir: false,
  ssr: { target: "node", noExternal: true },
  build: {
    ssr: true,
    target: "node24",
    outDir: "dist",
    emptyOutDir: true,
    minify: false,
    sourcemap: true,
    rolldownOptions: {
      input: { main: "src/main.ts", application: "src/server.ts" },
      output: { format: "es", entryFileNames: "[name].mjs", chunkFileNames: "chunks/[name]-[hash].mjs" }
    }
  }
})
