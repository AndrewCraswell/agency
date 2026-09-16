# Shared embedding contracts

C owns `src/embeddings/embedding-routing.ts`, tokenizers, exact-input preparation and the shared OpenRouter client.
Index jobs and W query runtime consume the same route, dimension, role and input-contract definitions. M calls W over
HTTP and does not embed or rerank. [I rollout](../../../../apps/legislation-ingestion/docs/engineering/embedding-rollout-plan.md)
owns dated evidence and the deferred full rebuild; [W retrieval](../../../../apps/legislation-web/docs/engineering/retrieval-acceptance.md)
owns dispatch and quality gates. Moving this contract does not approve regeneration.

## Retrieval products and embedding inputs

Structured identifiers, dates, jurisdictions, sessions, chambers, statuses, sponsors, committees and classifications
remain filters/joins, not substitutes for prose. Each product has separate judgments, promotion and source projection.

| Search product | Embedding input | Result returned to the caller |
| --- | --- | --- |
| Bill discovery | Bill title, summary, and subjects. Do not append a raw document excerpt or embed a bare identifier as if it described the policy. | Canonical bill with jurisdiction, session, sponsors, committees, actions, source links, and coverage metadata. |
| Bill-document passage search | Section heading and text under the accepted route; OCR retains provenance. | Canonical document section plus its document and bill, source URL and stored-object reference. |
| Structured amendment search | Purpose and description, with the accepted printed-identifier fallback. Sparse input is a quality limitation, not permission to invent a synopsis. | Canonical amendment, sponsor and dates, related bill and available passages. |
| Document-backed amendment search | Section heading and text under the document-section route. | Canonical `amendment:document:` result projected to its bill and document. |
| Supporting-material search | Section heading and text under the material route. | Canonical material/section, related bill and source/storage references. |

Contextual headers/lossless chunks are input-contract changes requiring evaluation and rebuild, not silently adopted
current inputs. The September exact-input integrity finding overrides historical hash-based reuse assumptions.

## Canonical canary routing contract

Full provider/model IDs are fixed contracts, not environment overrides: OpenAI Small 1,536 dimensions, Voyage 4 1,024
dimensions with document/query roles, and Cohere Rerank 3.5, all through OpenRouter. Credentials/base URL remain app-owned.

| Data indexed | Embedding input | Embedding model | Reranker | Expanded-bakeoff basis |
| --- | --- | --- | --- | --- |
| Bills | Current title, summary, and subjects | `voyageai/voyage-4` | `cohere/rerank-v3.5` for natural-language discovery | Voyage improved nDCG@10 by 0.027 over OpenAI Small; reranking added another 0.041. |
| Bill-document sections | Section heading and text | `openai/text-embedding-3-small` | `cohere/rerank-v3.5` for natural-language passage search | Reranking improved OpenAI nDCG@10 by 0.069 and reached the same 0.856 as reranked Voyage, avoiding Voyage's higher document-corpus generation cost. |
| Structured amendments | Purpose and description, with the printed identifier as the sparse fallback | `openai/text-embedding-3-small` | None | Voyage contextual improved only 0.007 over OpenAI; reranking reduced nDCG@10 by 0.030 or more. |
| Document-backed amendment sections | Section heading and text | `openai/text-embedding-3-small` | `cohere/rerank-v3.5` only when returned by `search_bill_text`; none in `search_amendments` | These use the same tested document-section model space and index; the graded canary reports the amendment classification separately. |
| Supporting-material sections | Section heading and text | `voyageai/voyage-4` | None | Voyage improved nDCG@10 by 0.263 and Recall@10 by 0.400; reranking reduced the strongest Voyage configuration. |

The table's bakeoff basis is retained historical selection evidence, not fresh corpus acceptance.

## Storage contract

Migration `0022` creates dedicated foreign-keyed tables under `legislation`, not broad-rollout vectors inline on corpus rows:

| Table | Exact model | Dimensions | Input contract |
| --- | --- | ---: | --- |
| `bill_embeddings` | `voyageai/voyage-4` | 1,024 | `bill-title-summary-subjects` |
| `document_section_embeddings` | `openai/text-embedding-3-small` | 1,536 | `document-section-heading-text` |
| `amendment_embeddings` | `openai/text-embedding-3-small` | 1,536 | `amendment-purpose-description-identifier-fallback` |
| `supporting_material_section_embeddings` | `voyageai/voyage-4` | 1,024 | `supporting-material-section-heading-text` |

Every row records source ID, exact model/dimensions, input contract/hash, vector, canary/rollout identity and creation/
refresh times. Index-time Voyage role is document; query-time is query. OpenAI uses its default role. First-stage
candidates are 25. Query consumers reject dimension/model/input drift rather than compare incompatible vector spaces.

A separate schema provides namespace/permissions, not physical storage, maintenance, backup or compute isolation.
Separate storage requires measured justification. Older inline vectors are non-authoritative; the September integrity
finding means matching old hashes cannot justify skipping the future approved full rebuild.

## Chunking and refresh identity

Token-aware chunks preserve natural sections and bounded overlap/context under the selected evaluated input contract.
Stable chunk identity binds source ID, normalized content hash, chunking version and ordinal. A model change creates
another embedding record, not another canonical source/chunk. The sampled 16,000-character cap rarely truncated sections
but was not a token budget; materials had a longer tail. Compare current and contextual/token-aware inputs explicitly.

The shared client submits accepted input intact and never shortens provider retries. Pinned local tokenizers validate
the complete prefixed input and hashes. Regulatory lossless reader spans are a separate
[reader contract](../regulations/reader-contract.md), not duplicated context in public source text.