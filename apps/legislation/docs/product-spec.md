# Legislative intelligence MVP product specification

## Primary user

The primary user is a legislative researcher, policy analyst, journalist, or public-affairs professional who needs to
find and verify state and federal legislation across jurisdictions without learning each source system. They need
canonical records, official source links, complete provenance, and predictable retrieval through an MCP-capable agent.

## Research scenarios and success measures

1. Known-bill lookup: retrieve a bill by canonical ID or jurisdiction, session, and printed identifier. Success means
   one correct canonical record is returned within two seconds at the service boundary, with title, current status,
   sponsors when available, and at least one official source link.
2. Topical discovery: search for bills concerning a topic across selected jurisdictions and dates. Success means the
   documented evaluation set places a relevant bill in the first ten results for at least 90 percent of test prompts,
   with explicit pagination and no result outside the requested filters.
3. Timeline review: explain the ordered actions and votes for a known bill. Success means all stored events are returned
   in stable chronological and upstream order, ties are deterministic, and each event retains its source attribution.
4. Passage search: find bill sections containing a phrase or semantic concept. Success means exact phrases are found by
   lexical search, semantic evaluation queries reach 80 percent recall at ten, and every match identifies its bill,
   document version, section, and source URL.
5. Version comparison: compare two official versions of a bill. Success means added, removed, and unchanged passages
   are distinguished, input versions are identified unambiguously, and truncated output reports that fact.

## Definition of done

The definition of done is the release contract in [the MVP implementation plan](mvp/README.md). Each milestone task
requires repository or target-environment evidence, and all milestone exit criteria are release gates.

## Explicit exclusions

- State real-time ingestion remains deferred until historical state coverage is reliable and a freshness requirement is
  approved.
- Committee media, recordings, transcripts, Mux, and Deepgram remain deferred until a research scenario requires media
  evidence.
- AI-generated summaries remain deferred until retrieval quality, provenance, and evaluation baselines are stable.
- Portfolios, watch lists, alerts, notifications, a web application, billing, and Novu remain deferred until the remote
  research interface demonstrates repeat use.
- Temporal, LangChain, LangGraph, Redis, OpenSearch, dedicated vector stores, and graph databases remain deferred until
  measured PostgreSQL or orchestration limits justify additional operational systems.

Any exclusion is reconsidered only through an architecture or product decision that names the new requirement,
evidence, cost, owner, and effect on the release contract.
