import { z } from "zod"
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

export function diagnosticTraceSampleRate(value: string | undefined) {
  if (!value?.trim()) {
    return 0
  }
  const rate = z.coerce.number().finite().min(0).max(1).safeParse(value)
  if (!rate.success) {
    console.warn("Telemetry tracing disabled: sample rate must be between 0 and 1")
    return 0
  }
  return rate.data
}
