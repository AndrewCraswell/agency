const diacritics = /[\u0300-\u036f]/g
const separators = /[^a-z0-9]+/g
const edgeDashes = /^-+|-+$/g

/**
 * Converts text into the URL segment Shopify derives from an article title.
 * The editor shows the result before publishing so a merchant sees the address readers will visit.
 */
export function toArticleHandle(value: string) {
  return value
    .normalize("NFKD")
    .replace(diacritics, "")
    .toLowerCase()
    .replace(separators, "-")
    .replace(edgeDashes, "")
    .slice(0, 255)
    .replace(edgeDashes, "")
}
