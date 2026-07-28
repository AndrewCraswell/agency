import { Node, mergeAttributes } from "@tiptap/core"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      /** Inserts an embedded player from a share URL, an embed URL, or a pasted `<iframe>` snippet. */
      setEmbed: (source: string, title?: string) => ReturnType
    }
  }
}

/** Fallback accessible name, so an embed never reaches the storefront as an unlabelled frame. */
const defaultEmbedTitle = "Embedded media"

const youtubeHosts = new Set(["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"])
const vimeoHosts = new Set(["vimeo.com", "player.vimeo.com"])

const iframeSource = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i
const youtubePath = /^\/(?:embed|shorts|v|live)\/([^/?#]+)/
const vimeoPath = /\/(\d{6,})/
const videoId = /^[\w-]{6,64}$/

function bareHost(url: URL) {
  return url.hostname.replace(/^www\./i, "").toLowerCase()
}

/**
 * Accepts whatever a merchant pastes and resolves it to a URL.
 * Embeds are forced onto https because the storefront is https and a browser blocks a mixed-content frame outright.
 */
function readUrl(input: string) {
  const trimmed = input.trim()
  const candidate = (iframeSource.exec(trimmed)?.[1] ?? trimmed).replace(/^\/\//, "")
  const absolute = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`
  try {
    const url = new URL(absolute)
    url.protocol = "https:"
    return url.hostname === "" ? null : url
  } catch {
    return null
  }
}

function readYoutubeId(url: URL) {
  if (bareHost(url) === "youtu.be") {
    return url.pathname.slice(1)
  }
  const fromPath = youtubePath.exec(url.pathname)?.[1]
  if (fromPath !== undefined) {
    return fromPath
  }
  return url.searchParams.get("v")
}

function youtubeEmbed(url: URL) {
  const id = readYoutubeId(url)
  if (id === null || id === undefined || !videoId.test(id)) {
    return null
  }
  // The nocookie host keeps the storefront out of YouTube's ad-tracking cookie jar until the visitor presses play.
  const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`)
  const start = url.searchParams.get("start") ?? url.searchParams.get("t")
  if (start !== null) {
    embed.searchParams.set("start", start.replace(/\D/g, ""))
  }
  return embed.toString()
}

/**
 * Rewrites the share URLs people actually copy into the player URLs that render in a frame.
 * Any other host passes through untouched, so merchants keep using whichever service they host video on.
 */
export function toEmbedSource(input: string) {
  const url = readUrl(input)
  if (url === null) {
    return null
  }
  const host = bareHost(url)
  if (youtubeHosts.has(host)) {
    return youtubeEmbed(url) ?? url.toString()
  }
  if (vimeoHosts.has(host)) {
    const id = vimeoPath.exec(url.pathname)?.[1]
    return id === undefined ? url.toString() : `https://player.vimeo.com/video/${id}`
  }
  return url.toString()
}

/**
 * A host-agnostic embed. The saved markup is a bare `<iframe>`, which is the only extra tag the article sanitizer
 * has to trust; the surrounding chrome below lives in the node view and never reaches the stored HTML.
 */
export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: defaultEmbedTitle }
    }
  },

  parseHTML() {
    return [{ tag: "iframe[src]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["iframe", mergeAttributes(HTMLAttributes, { allowfullscreen: "true", frameborder: "0", loading: "lazy" })]
  },

  /*
   * A raw iframe swallows pointer events, which would leave the merchant unable to click the video to select or
   * delete it. Wrapping it lets the editor own the click while CSS holds the frame itself inert.
   */
  addNodeView() {
    return ({ HTMLAttributes }) => {
      const dom = document.createElement("div")
      dom.className = "article-editor__embed"
      const frame = document.createElement("iframe")
      frame.setAttribute("allowfullscreen", "true")
      frame.setAttribute("frameborder", "0")
      for (const [attribute, value] of Object.entries(HTMLAttributes)) {
        if (value !== null && value !== undefined) {
          frame.setAttribute(attribute, String(value))
        }
      }
      dom.append(frame)
      return { dom }
    }
  },

  addCommands() {
    return {
      setEmbed:
        (source: string, title?: string) =>
        ({ commands }) => {
          const src = toEmbedSource(source)
          if (src === null) {
            return false
          }
          const trimmedTitle = title?.trim() ?? ""
          return commands.insertContent({
            type: this.name,
            attrs: { src, title: trimmedTitle === "" ? defaultEmbedTitle : trimmedTitle }
          })
        }
    }
  }
})
