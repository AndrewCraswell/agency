/**
 * The words the store's own catalogue is made of, which is how a subject is judged to be about this store.
 *
 * A product is titled "The Collection Snowboard: Hydrogen" and a shopper searches "snowboard height chart", so the two
 * only ever meet on a word. Matching whole titles against whole search phrases finds nothing at all, which reads as a
 * store that sells nothing rather than as a matching rule that is too strict.
 */

/** Below this a word is either a fragment or a function word, and both match far too much to mean anything. */
const SHORTEST_TERM = 4

/**
 * Words that carry no product meaning, so they would make every subject look relevant.
 *
 * The list is deliberately short. It holds English function words long enough to clear the length floor, and the
 * titles Shopify gives a storefront before a merchant has named anything.
 */
const IGNORED = new Set([
  "automated",
  "collection",
  "from",
  "home",
  "page",
  "that",
  "the",
  "their",
  "them",
  "these",
  "this",
  "with",
  "your"
])

/** Splits catalogue titles into the words worth matching on, lowercased and deduplicated. */
export function catalogueTerms(titles: string[]) {
  const terms = new Set<string>()
  for (const title of titles) {
    for (const word of title.toLowerCase().split(/[^\p{Letter}\p{Number}]+/u)) {
      if (word.length >= SHORTEST_TERM && !IGNORED.has(word)) {
        terms.add(word)
      }
    }
  }
  return terms
}
