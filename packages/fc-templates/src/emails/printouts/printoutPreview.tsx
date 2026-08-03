/** @jsxRuntime automatic */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { engine, sanitizeForPreview } from "../../liquid.ts"
import type { TemplateVariables } from "../../types.ts"

/*
 * A printout, shown in the same dev server as the emails.
 *
 * Order Printer has no preview short of pasting into the admin and printing an order, so a printout
 * is rendered here first, against the same fixtures its tests use. It is not an email, and the
 * server's send and client-width controls mean nothing for it, but the alternative is no preview.
 *
 * The .liquid is read from disk rather than imported as a string, because the file read is the very
 * file that gets pasted; a copy would be one more thing to keep in step. The path is resolved
 * against the working directory, which is the package the dev server was started from.
 *
 * Rendered synchronously because the dev server renders a component tree, not a promise. Nothing in
 * a printout reaches for a file or a network, so nothing here needs to wait.
 */

export type PrintoutPreviewProps = {
  readonly variables: TemplateVariables
}

type Printout = {
  /** Relative to the package root, so the reader sees the path they will open to copy from. */
  readonly file: string
  /** What the dev server's sidebar calls it. */
  readonly name: string
  readonly variables: TemplateVariables
}

export const definePrintoutPreview = ({ file, name, variables }: Printout) => {
  const path = resolve(file)

  const Preview = ({ variables: values }: PrintoutPreviewProps) => {
    const source = sanitizeForPreview(readFileSync(path, "utf8"))
    const markup = engine.parseAndRenderSync(source, values)
    // oxlint-disable-next-line no-danger -- the markup is this package's own render, not user input.
    return <div dangerouslySetInnerHTML={{ __html: markup }} />
  }

  Preview.displayName = name
  Preview.PreviewProps = { variables } satisfies PrintoutPreviewProps
  return Preview
}
