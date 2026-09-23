import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

export function assertStagingDeploymentAvailable(payload) {
  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value)
  if (
    !isRecord(payload) ||
    (payload.errors !== undefined && (!Array.isArray(payload.errors) || payload.errors.length !== 0)) ||
    !isRecord(payload.data) ||
    !isRecord(payload.data.variables)
  ) {
    throw new Error("Unable to verify the staging maintenance marker; deployment is blocked.")
  }
  const marker = payload.data.variables.LEGISLATION_STAGING_REFRESH_MAINTENANCE
  if (marker !== undefined && marker !== "false") {
    throw new Error("Staging refresh maintenance is active or invalid; deployment is blocked.")
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    assertStagingDeploymentAvailable(JSON.parse(readFileSync(0, "utf8")))
    process.stdout.write("Staging refresh maintenance is inactive.\n")
  } catch {
    process.stderr.write(
      "::error::Staging maintenance could not be cleared for deployment. No services were started.\n"
    )
    process.exitCode = 1
  }
}
