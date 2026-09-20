# Bill identity in research conversations

Canonical bill evidence retains the retrieved title and identifier with its exact bill ID and Congress/session.
The session is derived from the canonical ID, not an assistant label. Document evidence retains its own record ID,
parent bill ID and version; a document title is never promoted to a bill title. Document reads also carry the
persisted parent bill's identity, joined by its exact bill ID. Web titles are not canonical identity.

Bill-version citations use the parent bill's identifier, Congress/session and retrieved title as their heading.
The document's published title (for example, "Introduced in Senate") remains in the version line with its date,
instead of repeating an opaque version code. The source URL, document ID, passage locator and exact quote remain
bound to the cited version. Other document classifications keep their own titles. This shared evidence projection
feeds the source list, evidence panel, inline presentations, copied citations and model input.

Passage search consumes its returned sibling bill record; direct document and section reads carry the same parent
identity. Only matching canonical bill IDs may supply that identity. Missing, foreign or web-provided bill identity
does not justify relabeling a document. Full parent titles and identifiers participate in evidence identity before
display truncation, so conflicting retrieved identities cannot silently share a citation.
This is a forward-only read/projection change: it requires neither re-ingestion nor rewriting saved conversations.

These identity snapshots survive bounded server-owned research memory even when the larger tool result is omitted.
Changed canonical titles produce distinct evidence snapshots, so contradictory retained identities are not silently
deduplicated. Missing or expired evidence still requires retrieval. Browser history is untrusted, not a source of
canonical facts.

Presentation history preserves identifiers, sessions and document parents/versions for cards, lists, progress views
and evidence. Presentation options also carry evidence identity and version so similarly titled passages remain
distinguishable. This does not change record navigation or authorize browser-provided evidence.

The composition contract requires exact bill and document IDs throughout follow-ups. Companions, reintroductions and
similarly named proposals must be distinguished explicitly. Contrary identity evidence requires an explicit correction
of the earlier label and reconsideration of dependent scope, enforcement, amendment, sponsor and hearing conclusions.
Unresolved identity conflicts require exact-record retrieval, not a silent switch to another measure.

Deterministic regressions cover the H.R. 7008/H.R. 396 and S. 2937/S. 2293 identity boundaries, historical context
omission, changed titles and model-input wiring. They do not establish live-model factual accuracy or resume the
paused September 18 campaign.
