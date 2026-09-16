# Legislation UI

Use shadcn/ui components wherever suitable, with Rostra's design styling. Reuse installed components and add missing
ones from the configured registry instead of hand-building equivalent Radix/native UI. Follow
[frontend styling](docs/engineering/frontend-styling.md) and inspect the current Pencil design before implementation.

All product pages must compose the shared `AppShell` and `AppHeader`; do not duplicate header markup per page. Design
acceptance requires comparing the complete rendered screen to the current Pencil screen at desktop and mobile sizes, not
only checking individual component dimensions. Missing shell/navigation/sections are incomplete work, not implicitly
approved simplifications. Never populate missing live fields with design fixture content.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read
the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next`
package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at
`node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted
change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
