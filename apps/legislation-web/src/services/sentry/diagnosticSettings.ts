import { telemetryFields } from "./telemetryFields"

export function diagnosticEnvironment(value: string | undefined, runtime: string | undefined) {
  const selected = value?.trim() || runtime
  const parsed = telemetryFields.environment.safeParse(selected)
  if (parsed.success) {
    return parsed.data
  }
  if (selected !== undefined) {
    console.warn("Telemetry environment override ignored: use development, test, staging or production")
  }
  const fallback = telemetryFields.environment.safeParse(runtime)
  return fallback.success ? fallback.data : undefined
}
