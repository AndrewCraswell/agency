# Documentation

Focused reference pages for this monorepo. Keep pages **small and single-purpose**, and **update them in the same PR**
as the change they describe.

## Index

| Page                             | What it covers                                                                                                                                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [tech-stack.md](tech-stack.md)   | The preferred tools we reach for first (by category). Deviating requires a discussion with a human.                                                         |
| [conventions.md](conventions.md) | General conventions — quality gates, tests, imports, file/component layout; links out to the pages below.                                                   |
| [react.md](react.md)             | React component conventions, Fluent griffel styling, and the state/error/URL/routing/form libraries.                                                        |
| [typescript.md](typescript.md)   | TypeScript/type conventions **and** the type-helper libraries (`ts-extras`, `ts-pattern`, `tiny-invariant`, `zod`) — read before writing a new type helper. |
| [hooks.md](hooks.md)             | React hook conventions **and** the full `@mantine/hooks` catalog — read before writing a new hook.                                                          |
| [Agency UX design review](../apps/agentic/docs/agent-platform/ux-design-review.md) | Multi-persona review of the product interface, information architecture, workflow editor, and Fluent UI usage. |
| [workflow-lifecycle.md](workflow-lifecycle.md) | Mutable drafts, immutable active versions, and the canonical journal-backed run model. |
| [operations-query.md](operations-query.md) | Server-owned work-queue filtering, sorting, pagination, and URL state. |
| [action-availability.md](action-availability.md) | Consequence, permission, disabled-reason, and asynchronous status contracts. |
| [durable-scheduling.md](durable-scheduling.md) | Persisted schedule state, worker leases, retries, and missed-run policy. |

## Principles for these docs

- **Don't reinvent wheels.** [typescript.md](typescript.md) and [hooks.md](hooks.md) catalog what the installed
  libraries already provide. Check them before adding a hook or type helper.
- **One topic per page, kept short.** Prefer a new focused page over growing an existing one past a scannable length.
- **Docs stay current.** When behavior, tooling, or conventions change, update the relevant page (and this index) in the
  same change.
- **The agent entry point is [`.github/copilot-instructions.md`](../.github/copilot-instructions.md)**, which stays
  brief and links here rather than duplicating detail.
