import { defineConfig } from "@trigger.dev/sdk"

export default defineConfig({
  build: {
    autoDetectExternal: false,
    // PDF.js is loaded dynamically while extracting PDFs. Marking it external
    // makes Trigger install the complete package in the runtime layer, which
    // preserves both the dynamic module import and PDF.js standard-font assets.
    external: ["@napi-rs/canvas", "import-in-the-middle", "pdfjs-dist"]
  },
  dirs: ["./src/trigger/tasks"],
  legacyDevProcessCwdBehaviour: false,
  logLevel: "info",
  maxDuration: 3_600,
  project: "proj_bsjukvltatwjsyczuatb",
  retries: {
    default: {
      factor: 2,
      maxAttempts: 2,
      maxTimeoutInMs: 30_000,
      minTimeoutInMs: 5_000,
      randomize: true
    },
    enabledInDev: false
  },
  runtime: "node-22"
})
