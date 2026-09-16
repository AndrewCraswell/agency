# Generative UI rendering

Status: proposed. Depends on [answer composition](answer-composition.md).

## Recommendation

Evaluate `@json-render/core` and `@json-render/react` for catalog validation, component registration, progressive specs,
and inline conversation rendering. Keep the existing AI SDK agent and transport. Do not build a custom general-purpose
JSON-to-React framework if the library meets the requirements.

[json-render documentation](https://json-render.dev/docs) describes catalogs, registries, streaming, data binding, and
inline generation. [Tambo](https://docs.tambo.co/) offers broader agent/thread/backend orchestration; adopting it would
be a separate stack decision. Neither library supplies Rostra's evidence trust or deduplication policy automatically.

## Component boundary

Register existing Rostra domain components, adapted to trusted data and explicit action callbacks rather than coupled to
one conversation provider. The model chooses component type, record references, and constrained presentation options.
The renderer resolves metadata from validated data; arbitrary HTML, imports, CSS, event code, and unrestricted props
are not accepted. Do not give the model generic layout primitives sufficient to recreate an uncontrolled application.

Keep catalog entries narrow: entity reference, entity card, comparison, and citation/source inspection. Reuse existing
record drawers and navigation contracts. Do not put a full card inside another card or automatically reproduce all
tool results beneath the answer. Rich blocks belong at explicit positions among prose.

## Implementation tasks

- [ ] Inspect actual installed AI SDK/React versions and json-render APIs; pin a compatible version after dependency approval.
- [ ] Resolve web and shared-data package ownership after the workspace split; keep domain components in the appropriate frontend boundary.
- [ ] Create catalog entries with Zod schemas and a registry mapping them to existing components.
- [ ] Bind record fields from trusted data rather than model-supplied titles, sponsors, statuses, or source URLs.
- [ ] Define loading, invalid-reference, revoked-access, empty, and incomplete-response behavior.
- [ ] Keep block keys stable across stream updates, so interaction, expanded state, and keyboard focus survive.
- [ ] Preserve Rostra design conventions and inspect the current design source before frontend changes.

## Acceptance

- An existing card or comparison renders from validated record references without a second implementation of its layout.
- Unsupported props/actions and executable content are rejected; missing data is not filled with invented values.
- Desktop/mobile layouts, accessible names, keyboard inspection, and focus stability pass integrated-browser checks.
- Streaming updates do not repeatedly remount completed blocks or duplicate cards.
- Customer-facing copy is reviewed with Fluent Agent when available; unavailability is disclosed.

## Out of scope

No arbitrary model-generated React, general dashboard builder, or external-host iframe implementation here.
[Ordered streaming](ordered-streaming.md) owns placement within Rostra's conversation.