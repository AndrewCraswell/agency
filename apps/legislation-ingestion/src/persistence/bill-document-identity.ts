import { documentTransportUrl } from "../ingestion/documents/transport-url.js"

type DocumentIdentity = { id: string; billId: string; sourceUrl: string; classification: string }

function transportIdentity(sourceUrl: string) {
  const url = URL.parse(sourceUrl)
  // Unsupported source metadata remains representable, but is never transport-aliased.
  return url && (url.protocol === "http:" || url.protocol === "https:") ? documentTransportUrl(url).href : sourceUrl
}

/** Reuse IDs only within a bill and collection; do not erase path/query/version distinctions. */
export function findBillDocumentIdentity<T extends DocumentIdentity>(input: DocumentIdentity, existing: readonly T[]) {
  const scoped = existing.filter((document) => document.billId === input.billId)
  const exact = scoped.find((document) => document.id === input.id || document.sourceUrl === input.sourceUrl)
  if (exact) return exact
  const target = transportIdentity(input.sourceUrl)
  const aliases = scoped.filter(
    (document) => document.classification === input.classification && transportIdentity(document.sourceUrl) === target
  )
  if (aliases.length > 1) throw new Error("Document transport identity is ambiguous; reconcile retained aliases first")
  return aliases[0]
}
