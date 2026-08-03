import { readFileSync } from "node:fs"
import { relative } from "node:path"
import type { TemplateValues } from "./liquid/mode.ts"

/*
 * What `pull` wrote, laid over the samples so the preview shows the store it was read from rather
 * than the fixture shop. React Email loads a template in Node, which is the only reason this can be
 * a file read at all; nothing else in the package touches the filesystem.
 *
 * Laid over rather than swapped in, because a pulled order answers for the templates built from an
 * order and says nothing about a gift card or a campaign. Merging leaves those their sample and
 * still gives them the real shop and customer, which is what most of the branding is.
 *
 * Named by an environment variable and never guessed at, so a test or a build renders the samples
 * whatever files happen to be lying about the working directory. The `preview` command sets it.
 */

const isValues = (value: unknown): value is TemplateValues =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const read = (path: string): TemplateValues => {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!isValues(parsed)) {
    throw new Error(`${relative(process.cwd(), path)} holds ${typeof parsed}, not an object of variables.`)
  }
  return parsed
}

let pulled: TemplateValues | undefined
let looked = false

export const previewValues = (sample: TemplateValues): TemplateValues => {
  if (!looked) {
    looked = true
    const path = process.env["SHOPIFY_EMAILS_VALUES"]
    pulled = path ? read(path) : undefined
  }
  return pulled ? { ...sample, ...pulled } : sample
}
