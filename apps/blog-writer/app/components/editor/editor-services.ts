/**
 * Browser-side calls the article editor makes to the `/app/editor` resource route.
 *
 * These live apart from the components so the editor takes them as props and stays renderable in tests and
 * Storybook without a router. Shopify's App Bridge wraps `window.fetch` in the embedded admin, so the session
 * token travels with each request without any handling here.
 */

import { pickShopifyImage } from "../../lib/shopify-file-picker"

/** Mirrors `LinkableResource` in the workspace repository; kept local so no `.server` module reaches the browser. */
export type LinkableResource = {
  resourceId: string
  resourceType: "product" | "collection" | "blog" | "article" | "page"
  title: string
  url: string
}

const editorEndpoint = "/app/editor"

const genericFailure = "Something went wrong. Try again."

async function readMessage(response: Response) {
  try {
    const payload: unknown = await response.json()
    if (typeof payload === "object" && payload !== null && "message" in payload) {
      const { message } = payload as { message: unknown }
      if (typeof message === "string" && message !== "") {
        return message
      }
    }
  } catch {
    // A non-JSON body means an unexpected failure, which the generic message already covers.
  }
  return genericFailure
}

export async function searchLinkableResources(term: string, signal?: AbortSignal): Promise<LinkableResource[]> {
  const response = await fetch(`${editorEndpoint}?term=${encodeURIComponent(term)}`, { signal })
  if (!response.ok) {
    return []
  }
  const payload = (await response.json()) as { resources?: LinkableResource[] }
  return payload.resources ?? []
}

/**
 * Opens the admin's file picker and resolves the chosen file to an address the storefront can serve.
 * Resolves to `null` when the merchant closes the picker without choosing anything.
 */
export async function pickEditorImage(): Promise<{ url: string; altText: string } | { error: string } | null> {
  const picked = await pickShopifyImage()
  if (picked === null || "error" in picked) {
    return picked
  }

  const body = new FormData()
  body.set("intent", "resolveImage")
  body.set("imageId", picked.imageId)
  const response = await fetch(editorEndpoint, { method: "POST", body })
  if (!response.ok) {
    return { error: await readMessage(response) }
  }
  const payload = (await response.json()) as { url?: string; altText?: string }
  return payload.url === undefined ? { error: genericFailure } : { url: payload.url, altText: payload.altText ?? "" }
}

export async function rewriteEditorText(
  text: string,
  instruction: string
): Promise<{ text: string } | { error: string }> {
  const body = new FormData()
  body.set("intent", "rewriteText")
  body.set("text", text)
  body.set("instruction", instruction)
  const response = await fetch(editorEndpoint, { method: "POST", body })
  if (!response.ok) {
    return { error: await readMessage(response) }
  }
  const payload = (await response.json()) as { text?: string }
  return payload.text === undefined ? { error: genericFailure } : { text: payload.text }
}
