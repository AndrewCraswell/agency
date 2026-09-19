import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { expect, it } from "vitest"
import { z } from "zod"

it("filters actual native fetch propagation across two loopback origins", async () => {
  const { stdout } = await promisify(execFile)(
    process.execPath,
    ["--import", "tsx", fileURLToPath(new URL("./tracePropagation.worker.mjs", import.meta.url))],
    {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, TEMP: process.env.TEMP, NODE_ENV: "test" },
      timeout: 20000
    }
  )
  expect(
    z
      .object({
        propagated: z.literal(true),
        privateBaggageRemoved: z.literal(true),
        untrustedOriginClean: z.literal(true)
      })
      .parse(JSON.parse(stdout))
  ).toEqual({ propagated: true, privateBaggageRemoved: true, untrustedOriginClean: true })
}, 25000)
