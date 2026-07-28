import { afterEach, describe, expect, it, vi } from "vitest"
import { BlogDiscoveryError, discoverBlog } from "./discover.server"

const atomFeed = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>The Good Ride</title>
  <entry><title>Best boards of 2026</title></entry>
  <entry><title>Binding setup</title></entry>
</feed>`

const rssFeed = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title><![CDATA[Snowboard Addiction]]></title>
  <item><title>Butter basics</title></item>
  <item><title>Rail tricks</title></item>
</channel></rss>`

function respond(body: string, init: ResponseInit = {}) {
  return Promise.resolve(new Response(body, { status: 200, ...init }))
}

function notFound() {
  return Promise.resolve(new Response("", { status: 404 }))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Routes each requested address to a canned response, so a case only has to describe the site it is modelling. */
function stubSite(routes: Record<string, () => Promise<Response>>) {
  const fetchMock = vi.fn<(input: string) => Promise<Response>>((input) => (routes[input] ?? notFound)())
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

describe("discoverBlog", () => {
  it("accepts an address that is itself a feed", async () => {
    stubSite({ "https://example.com/blog.atom": () => respond(atomFeed) })

    await expect(discoverBlog("example.com/blog.atom")).resolves.toEqual({
      url: "https://example.com/blog.atom",
      hostname: "example.com",
      title: "The Good Ride",
      feedUrl: "https://example.com/blog.atom",
      articleCount: 2
    })
  })

  it("follows the feed a page declares for itself", async () => {
    stubSite({
      "https://example.com/blog": () =>
        respond(
          `<html><head><title>Example Blog</title>
           <link rel="alternate" type="application/rss+xml" href="/blog/rss.xml"></head>
           <body></body></html>`
        ),
      "https://example.com/blog/rss.xml": () => respond(rssFeed)
    })

    await expect(discoverBlog("https://example.com/blog")).resolves.toMatchObject({
      title: "Snowboard Addiction",
      feedUrl: "https://example.com/blog/rss.xml",
      articleCount: 2
    })
  })

  it("guesses the conventional feed address when a page declares none", async () => {
    stubSite({
      "https://example.com/blogs/news": () => respond("<html><head><title>News</title></head><body></body></html>"),
      "https://example.com/blogs/news.atom": () => respond(atomFeed)
    })

    await expect(discoverBlog("example.com/blogs/news")).resolves.toMatchObject({
      feedUrl: "https://example.com/blogs/news.atom",
      articleCount: 2
    })
  })

  it("counts articles on the page when the blog publishes no feed", async () => {
    stubSite({
      "https://example.com/journal": () =>
        respond(
          `<html><head><title>Journal</title></head>
           <body><article>First</article><article>Second</article><article>Third</article></body></html>`
        )
    })

    await expect(discoverBlog("example.com/journal")).resolves.toMatchObject({
      title: "Journal",
      feedUrl: null,
      articleCount: 3
    })
  })

  it("rejects an address that cannot be reached", async () => {
    stubSite({})

    await expect(discoverBlog("example.com/blog")).rejects.toMatchObject({
      name: "BlogDiscoveryError",
      code: "unreachable"
    })
  })

  it("rejects an address with no articles behind it", async () => {
    stubSite({
      "https://example.com/about": () =>
        respond("<html><head><title>About us</title></head><body><p>Hello</p></body></html>")
    })

    await expect(discoverBlog("example.com/about")).rejects.toBeInstanceOf(BlogDiscoveryError)
  })

  it("rejects a feed that lists a single entry", async () => {
    stubSite({
      "https://example.com/blog.atom": () =>
        respond('<?xml version="1.0"?><feed><title>Empty</title><entry><title>Only one</title></entry></feed>')
    })

    await expect(discoverBlog("example.com/blog.atom")).rejects.toMatchObject({ code: "noArticles" })
  })

  it("refuses to follow a redirect to a private address", async () => {
    const fetchMock = stubSite({
      "https://example.com/blog": () => respond("", { status: 302, headers: { location: "http://127.0.0.1/feed" } })
    })

    await expect(discoverBlog("example.com/blog")).rejects.toMatchObject({ code: "unreachable" })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("https://example.com/blog", expect.anything())
  })

  it("follows a redirect to another public address", async () => {
    stubSite({
      "https://example.com/blog": () =>
        respond("", { status: 301, headers: { location: "https://example.com/blogs/news.atom" } }),
      "https://example.com/blogs/news.atom": () => respond(atomFeed)
    })

    await expect(discoverBlog("example.com/blog")).resolves.toMatchObject({
      url: "https://example.com/blog",
      feedUrl: "https://example.com/blogs/news.atom"
    })
  })
})
