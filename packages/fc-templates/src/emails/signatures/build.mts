/*
 * Build step for the signatures. They are not Shopify templates, so `shopify-emails build` does not
 * emit them; this renders each React Email component to the email-safe HTML a reader pastes into a
 * mail client, and writes it beside the templates' own output under `dist/`.
 *
 * Run with `pnpm build:signatures`. React is imported for `createElement`, so the script stays a
 * plain module rather than JSX.
 */

import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { render } from "@react-email/render"
import { createElement } from "react"
import ClassicSignature from "./ClassicSignature.tsx"
import CompactSignature from "./CompactSignature.tsx"

const signatures = [
  { name: "classic", Component: ClassicSignature },
  { name: "compact", Component: CompactSignature }
] as const

const outDir = resolve("dist/signatures")
mkdirSync(outDir, { recursive: true })

for (const { name, Component } of signatures) {
  const html = await render(createElement(Component), { pretty: true })
  const file = resolve(outDir, `${name}.html`)
  writeFileSync(file, html)
  process.stdout.write(`Built dist/signatures/${name}.html (${html.length} bytes)\n`)
}
