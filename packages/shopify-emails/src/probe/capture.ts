import { observedNotificationDrops } from "../samples/observedDrops.ts"
import type { ProbeQuestions } from "./build.ts"

/*
 * Turning a pasted probe result back into data.
 *
 * The probe escapes every value for HTML so the document stays parseable whatever a drop contains,
 * which means whatever comes back — a saved preview, a "view source" of a test email, a copy out of
 * the rendered page — has to be un-escaped before it is JSON again. Doing that by eye across 130
 * keys is how a `null` gets mistaken for a `""`, so it happens here instead.
 */

const decodeEntities = (html: string): string =>
  html
    .replaceAll(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replaceAll(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")

/*
 * A mail client may rewrite the surrounding document freely, so the `<pre>` is found by its tags
 * rather than by any attribute Shopify or the client might have touched. The last `</pre>` wins
 * because a dumped value can legitimately contain the string, and a missing one is not an error
 * here: that is exactly what clipping looks like, and the parse below can say so with the evidence.
 */
const extractBlock = (html: string): string => {
  const open = html.indexOf("<pre")
  if (open === -1) {
    throw new Error("No <pre> block in the capture. Copy the whole rendered preview, not a screenshot of it.")
  }
  const start = html.indexOf(">", open)
  const close = html.lastIndexOf("</pre>")
  return html.slice(start + 1, close === -1 ? html.length : close)
}

/** What came back. Values are whatever `json` dumped, so nothing narrower than `unknown` is honest. */
export type CapturedValues = Readonly<Record<string, unknown>>

export const parseProbe = (html: string): CapturedValues => {
  const body = decodeEntities(extractBlock(html)).trim()
  try {
    return JSON.parse(body) as CapturedValues
  } catch (cause) {
    const clipped = !body.endsWith("}")
    const hint = clipped
      ? "The capture stops mid-object, which is what clipping looks like. Re-run with a narrower `names` and merge the results."
      : "The block is not JSON. If values came back unquoted, this dialect has no `json` filter and the probe cannot answer."
    throw new Error(`Could not read the probe result. ${hint}`, { cause })
  }
}

const isEmpty = (value: unknown): boolean => {
  if (value === "") {
    return true
  }
  if (Array.isArray(value)) {
    return value.length === 0
  }
  return typeof value === "object" && value !== null && Object.keys(value).length === 0
}

export type ProbeReport = {
  /** Answered with something. These are the drops a template can rely on. */
  readonly present: readonly string[]
  /** Exists but was blank for the order tested. Probe a richer order before concluding anything. */
  readonly empty: readonly string[]
  /** Nothing came back under that name. */
  readonly absent: readonly string[]
  /** Asked for, but missing from the capture, which means the run was clipped or edited. */
  readonly unanswered: readonly string[]
  /*
   * Absent, yet one of the 46 stock templates reads it. Either the drop only appears for other
   * notifications, or a template is reading something that is never there. Worth a look either way.
   */
  readonly absentButRead: readonly string[]
}

export const summariseProbe = (captured: CapturedValues, questions: ProbeQuestions): ProbeReport => {
  const read = new Set<string>(observedNotificationDrops)
  const present: string[] = []
  const empty: string[] = []
  const absent: string[] = []
  const unanswered: string[] = []

  for (const name of questions.names) {
    if (!(name in captured)) {
      unanswered.push(name)
      continue
    }
    const value = captured[name]
    if (value === null) {
      absent.push(name)
    } else if (isEmpty(value)) {
      empty.push(name)
    } else {
      present.push(name)
    }
  }

  return {
    absent,
    absentButRead: absent.filter((name) => read.has(name)),
    empty,
    present,
    unanswered
  }
}
