# Exact legal reader contract

C owns `src/legal-text/reader-contract.ts`, `reader-text.ts`, rights and typed API-client validation. I owns parser,
source blocks and generation; W owns authorization/query/HTTP serving; M owns transport. One invariant serves all apps.

## Body and block identity

Readable blocks are not retrieval chunks. Stable block IDs bind exact canonical body/generation; UTF-16 start/end
intervals are contiguous and non-overlapping, retaining source ordinal, kind, tag, text, table tabs/newlines and footnotes.
Concatenation reconstructs the canonical body exactly, without repeated embedding context. Initial representation is
plain text, never executable HTML or returned source XML. Rich table-cell rendering remains a separate gate.

Maximum block size is 16,384 UTF-16 characters; maximum ordinary window is 100 blocks and 100,000 characters, default
20 blocks. Oversized blocks split losslessly without breaking surrogate pairs. Body/block mismatch fails validation;
empty structural nodes are explicit. W may impose database read bounds and M stricter transport windows independently.

## Selection and continuation

`LegalTextWindow` includes `versionId`, `readerContract`, `bodyHash`, `blockGeneration`, `format`, `blocks`, `totalBlocks`,
`startBlock`, `nextCursor`, `isStart`, `isEnd`, `availability` and `textTruncated`. The serving boundary attaches verified
`selectedContext`, not this pure projection. A provision uses strict edition context; a publication uses its source
observation with no invented code edition. Local preview IDs are not canonical public version IDs.

Use anchor for the first window, then cursor until null. Search links carry an exact authorized text URL and block
anchor. Continuation binds user/organization, exact version, selected edition/observation, rights revision, reader
generation and limit. A cursor is a position, not an access grant; W rechecks rights every page, never substitutes
another edition after correction/restriction. Pagination is distinct from source incompleteness.

Client validation checks source/version/context identity, intervals, size, availability and continuation consistency.
Rights filtering precedes text, counts, snippets and ranking. The [data contract](data-contract.md) owns temporal and
rights semantics. [W reader](../../../../apps/legislation-web/docs/regulations/legal-text-serving.md) owns API limits/errors;
[M tool](../../../../apps/legislation-mcp/docs/engineering/legal-tools.md) owns the narrower combined-output budget.