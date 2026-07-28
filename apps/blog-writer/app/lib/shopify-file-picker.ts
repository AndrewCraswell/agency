/**
 * Opens the admin's own file picker through App Bridge intents.
 *
 * This is the same dialog the admin shows for its own image fields, so merchants browse the store's files, upload
 * new ones, and generate images without this app rebuilding any of it. The picker hands back a `MediaImage`
 * identifier rather than an address, which the server exchanges for a URL the storefront can serve.
 */

const unavailable = "Images can only be chosen from inside the Shopify admin."
const failed = "That image could not be chosen. Try again."

/** Resolves to the chosen file, to a message worth showing, or to `null` when the merchant closes the picker. */
export async function pickShopifyImage(): Promise<{ imageId: string } | { error: string } | null> {
  if (typeof shopify === "undefined" || shopify.intents.invoke === undefined) {
    return { error: unavailable }
  }

  const activity = await shopify.intents.invoke("pick:shopify/File", {
    data: { mediaTypes: ["MediaImage"], multiSelect: false }
  })
  const response = await activity.complete
  if (response === undefined || response.code === "closed") {
    return null
  }
  if (response.code === "error") {
    return { error: response.message ?? failed }
  }

  const ids = "data" in response ? response.data?.ids : undefined
  const imageId = Array.isArray(ids) ? ids[0] : undefined
  return typeof imageId === "string" ? { imageId } : null
}
