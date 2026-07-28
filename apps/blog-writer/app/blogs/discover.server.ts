import { parsePublicHttpUrl } from "../persistence/contracts.server"

/**
 * Discovery is a gate on a form submission, so it has to answer while the merchant is still looking at the field. The
 * budget below is the whole check, across every candidate address tried.
 */
const REQUEST_TIMEOUT_MS = 8_000
const MAX_REDIRECTS = 3
const MAX_BYTES = 512 * 1024

/** Enough entries to tell a blog from a page that happens to carry one link to an article. */
const MINIMUM_ARTICLE_COUNT = 2

/** Raised when an address is not a reachable blog. The code says which of the two failures the merchant hit. */
export class BlogDiscoveryError extends Error {
  readonly code: "unreachable" | "noArticles"

  constructor(code: "unreachable" | "noArticles", message: string) {
    super(message)
    this.name = "BlogDiscoveryError"
    this.code = code
  }
}

export type DiscoveredBlog = {
  /** The address the merchant gave, normalized. */
  url: string
  hostname: string
  /** The blog's own name, taken from its feed or page title, so the merchant sees what they subscribed to. */
  title: string | null
  /** The feed the articles were counted in, or null when they were counted on the page itself. */
  feedUrl: string | null
  articleCount: number
}

type Document = { url: string; body: string }

/**
 * Reads at most {@link MAX_BYTES} of a response.
 *
 * A blog index can stream indefinitely, and the markup that identifies one is in the first few kilobytes, so the read
 * is capped rather than trusted to end.
 */
async function readBoundedText(response: Response) {
  const body = response.body
  if (body === null) {
    return ""
  }

  const decoder = new TextDecoder()
  const reader = body.getReader()
  let text = ""
  let byteCount = 0
  try {
    while (byteCount < MAX_BYTES) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      byteCount += value.byteLength
      text += decoder.decode(value, { stream: true })
    }
  } finally {
    await reader.cancel().catch(() => undefined)
  }
  return text
}

/**
 * Fetches an address, following redirects by hand.
 *
 * Every hop is re-validated as a public web address, because a merchant-supplied URL that redirects is otherwise a way
 * to make the server fetch somewhere it was never allowed to go.
 */
async function fetchDocument(address: string): Promise<Document | null> {
  let current = address
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: Response
    try {
      response = await fetch(current, {
        redirect: "manual",
        headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/html;q=0.9" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
    } catch {
      return null
    }

    const location = response.headers.get("location")
    if (response.status >= 300 && response.status < 400 && location !== null) {
      try {
        current = parsePublicHttpUrl(new URL(location, current).toString()).url
      } catch {
        return null
      }
      continue
    }

    if (!response.ok) {
      return null
    }
    return { url: current, body: await readBoundedText(response) }
  }
  return null
}

function stripMarkup(value: string) {
  return value
    .replaceAll(/<!\[CDATA\[|\]\]>/gu, "")
    .replaceAll(/<[^>]*>/gu, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll(/\s+/gu, " ")
    .trim()
}

function readTitle(body: string) {
  const match = /<title\b[^>]*>([\s\S]{0,300}?)<\/title>/iu.exec(body)
  if (match?.[1] === undefined) {
    return null
  }
  const title = stripMarkup(match[1])
  return title === "" ? null : title
}

function isFeed(body: string) {
  return /<(?:rss|feed|rdf:RDF)[\s>]/iu.test(body.slice(0, 4_000))
}

function countFeedEntries(body: string) {
  const items = body.match(/<item[\s>]/giu)?.length ?? 0
  const entries = body.match(/<entry[\s>]/giu)?.length ?? 0
  return items + entries
}

/** Counts the article cards on a rendered index page, for blogs that publish no feed at all. */
function countPageArticles(body: string) {
  return body.match(/<article[\s>]/giu)?.length ?? 0
}

/** The feeds a page declares for itself. A blog that has one names it in the head, so this is tried before guessing. */
function findDeclaredFeeds(body: string, baseUrl: string) {
  const found: string[] = []
  for (const tag of body.match(/<link\b[^>]{0,600}>/giu) ?? []) {
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/iu.exec(tag)?.[1]?.toLowerCase()
    if (type !== "application/rss+xml" && type !== "application/atom+xml" && type !== "application/feed+json") {
      continue
    }
    const href = /\bhref\s*=\s*["']([^"']+)/iu.exec(tag)?.[1]
    if (href === undefined) {
      continue
    }
    try {
      found.push(parsePublicHttpUrl(new URL(href, baseUrl).toString()).url)
    } catch {
      continue
    }
  }
  return [...new Set(found)]
}

/**
 * The addresses a blog's feed conventionally lives at, for platforms that publish one without declaring it. Shopify
 * appends `.atom` to the blog path; most other platforms hang a feed off the blog path or the site root.
 */
function guessFeedAddresses(address: string) {
  const url = new URL(address)
  const path = url.pathname.replace(/\/$/u, "")
  const candidates = [`${url.origin}${path}.atom`, `${url.origin}${path}/feed`, `${url.origin}/feed`]
  return [...new Set(candidates.filter((candidate) => candidate !== address))]
}

/**
 * Confirms an address is a blog we can read articles from, and reports what was found.
 *
 * Subscribing to an address nobody validated means the merchant learns their source was wrong only when research comes
 * back thin, weeks later and with no obvious cause. Checking at the point of entry turns that into an error they can
 * act on immediately.
 */
export async function discoverBlog(value: string): Promise<DiscoveredBlog> {
  const { hostname, url } = parsePublicHttpUrl(value)

  const document = await fetchDocument(url)
  if (document === null) {
    throw new BlogDiscoveryError("unreachable", `Could not reach ${url}`)
  }

  if (isFeed(document.body)) {
    const articleCount = countFeedEntries(document.body)
    if (articleCount >= MINIMUM_ARTICLE_COUNT) {
      return { url, hostname, title: readTitle(document.body), feedUrl: document.url, articleCount }
    }
    throw new BlogDiscoveryError("noArticles", `No articles were listed at ${url}`)
  }

  const pageTitle = readTitle(document.body)
  const feedAddresses = [...findDeclaredFeeds(document.body, document.url), ...guessFeedAddresses(document.url)]
  for (const feedAddress of feedAddresses) {
    const feed = await fetchDocument(feedAddress)
    if (feed === null || !isFeed(feed.body)) {
      continue
    }
    const articleCount = countFeedEntries(feed.body)
    if (articleCount >= MINIMUM_ARTICLE_COUNT) {
      return { url, hostname, title: readTitle(feed.body) ?? pageTitle, feedUrl: feed.url, articleCount }
    }
  }

  const pageArticleCount = countPageArticles(document.body)
  if (pageArticleCount >= MINIMUM_ARTICLE_COUNT) {
    return { url, hostname, title: pageTitle, feedUrl: null, articleCount: pageArticleCount }
  }

  throw new BlogDiscoveryError("noArticles", `No articles were found at ${url}`)
}
