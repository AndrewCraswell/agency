/** The default document transport never fetches HTTP; it requests the HTTPS equivalent. */
export function documentTransportUrl(source: string | URL, allowHttp = false): URL {
  const url = new URL(source)
  if (url.protocol === "http:" && !allowHttp) url.protocol = "https:"
  if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
    throw new Error("Document URL must use HTTPS")
  }
  return url
}
