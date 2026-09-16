import { RetryingHttpClient } from "../http-client.js"

export interface OpenStatesArchive {
  jurisdictionCode: string
  session: string
  url: URL
}

export async function discoverOpenStatesArchives(
  client: RetryingHttpClient,
  indexUrl = new URL("https://open.pluralpolicy.com/data/session-json/")
): Promise<OpenStatesArchive[]> {
  const response = await client.get(indexUrl)
  const html = await response.text()
  const archives = new Map<string, OpenStatesArchive>()
  for (const match of html.matchAll(/href=["']([^"']+\.(?:zip|json|jsonl|gz))["']/gi)) {
    const href = match[1]
    if (href === undefined) {
      continue
    }
    const url = new URL(href, indexUrl)
    if (url.protocol !== "https:") {
      continue
    }
    const decoded = decodeURIComponent(url.pathname)
    const parts = decoded.split("/").filter(Boolean)
    const fileName = parts.at(-1)?.replace(/\.(?:jsonl?|zip|gz)$/i, "") ?? ""
    const parent = parts.at(-2) ?? ""
    const grandparent = parts.at(-3) ?? ""
    const currentArchiveMatch = /^([a-z]{2})_(.+)_json_[a-z0-9]+$/i.exec(fileName)
    const fileMatch = currentArchiveMatch ?? /^([a-z]{2})[-_](.+)$/i.exec(fileName)
    let jurisdictionCode = fileMatch?.[1]?.toLowerCase() ?? ""
    let session = fileMatch?.[2] ?? ""
    if (/^[a-z]{2}$/i.test(parent)) {
      jurisdictionCode = parent.toLowerCase()
      session = fileName
    } else if (/^[a-z]{2}$/i.test(grandparent)) {
      jurisdictionCode = grandparent.toLowerCase()
      session = parent
    }
    if (/^[a-z]{2}$/.test(jurisdictionCode) && session.length > 0) {
      archives.set(url.href, { jurisdictionCode, session, url })
    }
  }
  return [...archives.values()].sort((left, right) => left.url.href.localeCompare(right.url.href))
}
