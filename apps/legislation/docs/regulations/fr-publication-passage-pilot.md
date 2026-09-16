# Federal Register passage and lexical pilot

September 15, 2026. Scope: all 110 canonical publications in the January 18, 2000 issue, from the
[source identity and publication pilot](fr-source-identities.md). Source database is the isolated local pilot on
port 55452; target is its separate `legislation_passage_search` database. No source import was repeated.

## Source reconstruction and table repair

The full shape inventory found 16 table-bearing publications and exact reader reconstruction for every body.
Two publications initially failed table layout because five empty GPO `<ROW RUL="…"/>` elements represent ruling
lines, not data rows. Three exact table excerpts are retained in `fixtures/fr-2000-01-18-ruling-tables.json`, with
source URL, artifact hash and publication locator. They come from the EPA ozone rule and Texas permitting proposal.

`table-passages.ts` now accepts only empty `ROW` elements without child elements, with a nonempty `RUL` attribute
and optional `EXPSTB`. They contribute no canonical text. Empty cells, graphics, unknown row attributes, spans and
generic empty rows remain rejected. Rulings clear group/ditto context rather than supplying an unsupported reference
across a visual divider. Both row range construction and cell lookup use the same rule. No input contract was bumped.

The repeated inventory has zero blocked table layouts. All 110 publications prepared successfully with both pinned
tokenizers using the existing durable worker. Independent readback compared every concatenated passage body and
reader span with canonical text, recomputed input hashes, and recounted every complete model input.

| Offline tokenizer | Versions | Passages | Total input tokens | Maximum tokens/input | Maximum characters/input |
| --- | ---: | ---: | ---: | ---: | ---: |
| OpenAI Small | 110 | 873 | 412,347 | 1,116 | 4,540 |
| Voyage 4 | 110 | 927 | 445,847 | 1,072 | 4,540 |

All inputs fit the 1,200-token and 16,000-character preparation limits. No row continuations were needed for this
issue. Counts include context; these are local tokenizer measurements, not provider billing or retrieval-quality
results. Model selection remains open. There were zero provider requests and zero embedding writes.

## Isolated lexical copy

The pilot selected the OpenAI-tokenized passage boundaries for lexical testing only. The existing copy worker and
whole-scope verifier copied and acknowledged all 110 scopes and 873 passages; zero publication outbox events remain
pending. The canonical Voyage preparations remain available for evaluation. This does not choose an embedding model.

Internal, version-scoped search verified the collision boundaries: `Hobbs` returns the airspace rule, with zero
`Seretha` hits in that scope; `Seretha` returns the Minnesota notice, with zero `Hobbs` hits in its scope. The search
service rechecks canonical rights, scope receipts and candidate content. These are internal lexical checks, not
authenticated HTTP/MCP endpoint acceptance, cross-corpus ranking or production availability.

## Evidence and remaining gates

Artifacts under `artifacts/regulatory-backfills/`:

- `fr-jan18-passage-shapes.json` and `fr-jan18-passage-shapes-accepted.json`: every version and table-layout outcome.
- `fr-jan18-passage-preparation.json`: all 220 model/scope jobs completed without errors.
- `fr-jan18-passage-manifest.json` and `fr-jan18-passage-audit.json`: exact version, context, input and source-span
  manifests; combined manifest hash `bda326e6210eaeb209ddd7e409fe37e01e06427ed1b7fbbfbd4b024d9352b688`.
- `fr-jan18-lexical-copy.json`: 110 copy/acknowledgement results, target inventory and positive/negative canaries.

Twenty-eight focused table/passage tests passed, including the real source fixtures and rejected ambiguous empty
structures. Root `pnpm verify` passed all nine tasks in 2m37s; `git diff --check` passed.
Broader nested/spanning/oversized-context cases, frozen release-wide preparation, deployed orchestration,
cross-version search, final model evaluation and authenticated HTTP/MCP still need their backlog gates. Recurring
source collection and bulk regulatory embeddings remain disabled; existing embeddings were not regenerated.
