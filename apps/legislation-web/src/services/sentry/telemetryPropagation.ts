export function telemetryPropagationTarget(
  baseUrl: string | undefined,
  environment: string | undefined,
  options: Readonly<{ allowLocalHttpInProduction?: boolean }> = {}
) {
  if (!baseUrl?.trim()) {
    return undefined
  }
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error("Telemetry requires a valid first-party URL")
  }
  const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
  if (
    (parsed.protocol !== "https:" &&
      !(
        parsed.protocol === "http:" &&
        isLocal &&
        (environment !== "production" || options.allowLocalHttpInProduction)
      )) ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Telemetry first-party URL must use HTTPS without credentials, query or fragment")
  }
  return new RegExp(`^${parsed.origin.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?:/|$)`, "iu")
}
