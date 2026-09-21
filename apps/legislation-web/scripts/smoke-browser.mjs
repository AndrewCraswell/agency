import { pathToFileURL } from "node:url"
import { chromium } from "playwright"

export function browserSmokeOrigin(environment) {
  const base = URL.parse(environment.LEGISLATION_BROWSER_SMOKE_BASE_URL ?? "")
  if (
    !base ||
    base.protocol !== "https:" ||
    base.username ||
    base.password ||
    base.pathname !== "/" ||
    base.search ||
    base.hash
  ) {
    throw new Error("LEGISLATION_BROWSER_SMOKE_BASE_URL must be a credential-free HTTPS origin")
  }
  return base
}

async function main() {
  const base = browserSmokeOrigin(process.env)
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    const failures = []
    page.on("pageerror", (error) => failures.push(error.message))
    const response = await page.goto(base.href, { waitUntil: "domcontentloaded", timeout: 60_000 })
    if (!response?.ok()) {
      throw new Error(`Staging homepage returned ${response?.status() ?? "no response"}`)
    }
    await page.locator("body").waitFor({ state: "visible" })
    if ((await page.locator("body").innerText()).trim().length === 0) {
      throw new Error("Staging homepage rendered no readable content")
    }
    const representatives = new URL("/representatives", base)
    const representativesResponse = await page.goto(representatives.href, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    })
    if (!representativesResponse?.ok()) {
      throw new Error(`Representative lookup returned ${representativesResponse?.status() ?? "no response"}`)
    }
    await page.locator("body").waitFor({ state: "visible" })
    if ((await page.locator("body").innerText()).trim().length === 0) {
      throw new Error("Representative lookup rendered no readable content")
    }
    if (failures.length > 0) {
      throw new Error(`Staging browser raised page errors: ${failures.join("; ")}`)
    }
    process.stdout.write(`${JSON.stringify({ pages: [base.href, representatives.href], status: "ok" })}\n`)
  } finally {
    await browser.close()
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main()
}
