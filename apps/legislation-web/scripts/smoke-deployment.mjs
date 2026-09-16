const base = URL.parse(process.env.LEGISLATION_API_SMOKE_BASE_URL ?? "")
if (
  !base ||
  base.protocol !== "https:" ||
  base.username ||
  base.password ||
  base.pathname !== "/" ||
  base.search ||
  base.hash
) {
  throw new Error("LEGISLATION_API_SMOKE_BASE_URL must be a credential-free HTTPS origin")
}
const token = process.env.LEGISLATION_API_SMOKE_TOKEN?.trim()
if (!token) {
  throw new Error("LEGISLATION_API_SMOKE_TOKEN is required")
}
const boundedFetch = (path, headers = {}) =>
  fetch(new URL(path, base), {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  })
const health = await boundedFetch("/health")
const ready = await boundedFetch("/ready")
if (!health.ok || !ready.ok) {
  throw new Error(`Web health smoke failed: health=${health.status}, ready=${ready.status}`)
}
await health.text()
await ready.text()
const api = await boundedFetch("/api/jurisdictions?limit=1", { authorization: `Bearer ${token}` })
if (!api.ok) {
  throw new Error(`Authenticated API smoke failed with status ${api.status}`)
}
const body = await api.json()
const correlationId = api.headers.get("x-correlation-id")
if (
  !Array.isArray(body?.data) ||
  correlationId === null ||
  body.meta?.correlationId !== correlationId ||
  body.meta?.limit !== 1 ||
  typeof body.meta?.truncated !== "boolean" ||
  typeof body.links?.self !== "string" ||
  !(body.links?.next === null || typeof body.links?.next === "string")
) {
  throw new Error("Authenticated API smoke returned invalid page metadata")
}
const item = body.data[0]
if (item !== undefined) {
  const canonical = typeof item.canonicalUrl === "string" ? URL.parse(item.canonicalUrl) : null
  if (
    typeof item.id !== "string" ||
    item.id.length === 0 ||
    !canonical ||
    !["http:", "https:"].includes(canonical.protocol) ||
    !Array.isArray(item.sources) ||
    item.sources.length === 0 ||
    typeof item.updatedAt !== "string" ||
    Number.isNaN(Date.parse(item.updatedAt))
  ) {
    throw new Error("Authenticated API smoke returned a non-canonical item")
  }
}
process.stdout.write(`${JSON.stringify({ api: api.status, health: health.status, ready: ready.status })}\n`)
