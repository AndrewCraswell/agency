import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { expect, it } from "vitest"
import { z } from "zod"

const execute = promisify(execFile)
const reportSchema = z.strictObject({
  mode: z.enum(["enabled", "disabled", "offline"]),
  runtime: z.literal("VercelEdgeClient"),
  requestsCompleted: z.literal(2),
  errors: z.number().int(),
  transactions: z.number().int(),
  isolated: z.literal(true),
  propagationRestricted: z.literal(true)
})

it.each(["enabled", "disabled", "offline"])(
  "runs the actual edge SDK in an isolated %s process",
  async (mode) => {
    const result = await execute(
      process.execPath,
      [
        "--conditions=edge-light",
        "--import",
        "tsx",
        fileURLToPath(new URL("./edgeTelemetry.worker.mjs", import.meta.url)),
        mode
      ],
      {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, NODE_ENV: "test" },
        timeout: 20000
      }
    )
    const report = reportSchema.parse(JSON.parse(result.stdout))
    expect(report).toMatchObject({
      mode,
      runtime: "VercelEdgeClient",
      requestsCompleted: 2,
      isolated: true,
      propagationRestricted: true
    })
    expect(report.errors).toBe(mode === "enabled" ? 2 : 0)
    expect(report.transactions).toBe(mode === "enabled" ? 2 : 0)
    expect(result.stderr).not.toMatch(/You have to set up|PRIVATE-/u)
  },
  25000
)
