import { pathToFileURL } from "node:url"

const dynamicCacheValues = new Set(["DYNAMIC", null])
const cacheableAssetPattern = /(?:src|href)="(?<path>\/_next\/static\/[^"]+)"/gu

function cacheDirectives(response) {
  return new Set(
    (response.headers.get("cache-control") ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  )
}

export function assertPrivateNoStore(response, path, expectCdn) {
  const directives = cacheDirectives(response)
  if (!directives.has("private") || !directives.has("no-store")) {
    throw new Error(`${path} must return Cache-Control: private, no-store`)
  }
  const cache = response.headers.get("x-cache")
  if (expectCdn && !dynamicCacheValues.has(cache)) {
    throw new Error(`${path} must bypass shared caching; received x-cache: ${cache}`)
  }
}

export function findStaticAsset(html) {
  return cacheableAssetPattern.exec(html)?.groups?.path ?? null
}

async function request(base, path, headers) {
  return await fetch(new URL(path, base), {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  })
}

async function main() {
  const base = URL.parse(process.env.LEGISLATION_CDN_SMOKE_BASE_URL ?? "")
  if (
    !base ||
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("LEGISLATION_CDN_SMOKE_BASE_URL must be a credential-free HTTPS origin")
  }
  const expectCdn = process.env.LEGISLATION_CDN_EXPECT_ENABLED !== "false"

  const home = await request(base, "/")
  if (!home.ok) {
    throw new Error(`Homepage returned ${home.status}`)
  }
  assertPrivateNoStore(home, "/", expectCdn)
  const assetPath = findStaticAsset(await home.text())
  if (!assetPath) {
    throw new Error("Homepage did not reference a Next.js static asset")
  }

  for (const path of ["/health", "/ready", "/chat", "/api"]) {
    const response = await request(base, path)
    if (path !== "/api" && !response.ok) {
      throw new Error(`${path} returned ${response.status}`)
    }
    assertPrivateNoStore(response, path, expectCdn)
  }

  const publicHtmlFirst = await request(base, "/representatives")
  const publicHtmlSecond = await request(base, "/representatives")
  if (!publicHtmlFirst.ok || !publicHtmlSecond.ok) {
    throw new Error("Public representative lookup HTML did not load")
  }

  const assetFirst = await request(base, assetPath)
  const assetSecond = await request(base, assetPath)
  if (!assetFirst.ok || !assetSecond.ok) {
    throw new Error(`Static asset ${assetPath} did not load`)
  }

  if (expectCdn) {
    if (publicHtmlSecond.headers.get("x-cache") !== "HIT") {
      throw new Error(`Public HTML did not reach a cache HIT: ${publicHtmlSecond.headers.get("x-cache")}`)
    }
    if (assetSecond.headers.get("x-cache") !== "HIT") {
      throw new Error(`Static asset did not reach a cache HIT: ${assetSecond.headers.get("x-cache")}`)
    }
    const authorizedAsset = await request(base, assetPath, { authorization: "Bearer cache-bypass-probe" })
    if (authorizedAsset.headers.get("x-cache") !== null) {
      throw new Error("An authorized request must bypass the CDN before cache lookup")
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      asset: assetPath,
      assetCache: assetSecond.headers.get("x-cache"),
      cdnExpected: expectCdn,
      dynamicCache: home.headers.get("x-cache"),
      publicHtmlCache: publicHtmlSecond.headers.get("x-cache")
    })}\n`
  )
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}
