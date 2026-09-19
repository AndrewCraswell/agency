import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { expect, it } from "vitest"
import { z } from "zod"

const execute = promisify(execFile)
const reportSchema = z.object({ mode: z.string(), passed: z.literal(true) })

it.each([
  "both",
  "recording",
  "sentry",
  "langfuse",
  "disabled",
  "offline",
  "registration",
  "conflict",
  "context_conflict",
  "unsafe_target",
  "timeout"
])(
  "verifies the isolated shared Node runtime in %s mode",
  async (mode) => {
    const { stdout, stderr } = await execute(
      process.execPath,
      ["--import", "tsx", fileURLToPath(new URL("./nodeTelemetry.worker.mjs", import.meta.url)), mode],
      {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, NODE_ENV: "test" },
        timeout: 25000
      }
    )
    expect(reportSchema.parse(JSON.parse(stdout))).toMatchObject({ mode, passed: true })
    expect(stderr).not.toMatch(/PRIVATE|You have to set up/u)
  },
  30000
)
