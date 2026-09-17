import { pythonExtension } from "@trigger.dev/python/extension"
import { defineConfig } from "@trigger.dev/sdk"

export default defineConfig({
  build: {
    autoDetectExternal: false,
    // Package the adapter only. Upstream dependencies and source are still gated on
    // dependency compatibility and verified image startup; no scraper task is activated here.
    extensions: [
      pythonExtension({
        scripts: [
          "./python/openstates_runner.py",
          "./python/prepare_openstates.py",
          "./python/openstates_source_policy.py",
          "./python/alaska_journal.py",
          "./python/alaska_meeting_partition.py",
          "./python/plan_alaska_events.py",
          "./python/regulations/parse_xml.py"
        ]
      })
    ],
    // PDF.js is loaded dynamically while extracting PDFs. Marking it external
    // makes Trigger install the complete package in the runtime layer, which
    // preserves both the dynamic module import and PDF.js standard-font assets.
    external: ["@napi-rs/canvas", "import-in-the-middle", "pdfjs-dist", "tiktoken"]
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
