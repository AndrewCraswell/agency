# Remaining regulatory MCP tasks

M owns these original TOOLS task IDs. W owns [HTTP/product tasks](../../../legislation-web/docs/regulations/api-mcp-production-tasks.md);
I owns the [program backlog](../../../legislation-ingestion/docs/regulations/production-backlog.md). Use the existing
API adapter, independently acquired audience-separated credentials and combined response budgeting, never caller-token
forwarding or a new exchange design. Registration waits for the corresponding endpoint. TOOLS-05 is bounded model
acceptance, not a dependency on every remaining tool.

- [ ] **TOOLS-01 Add shared typed API adapter calls.** Map actual client methods and safe errors; retain correlation
  and exact selection. Done: no model key, database pool, ingestion control or source fetch reachable from M.
  Depends on HTTP-01 and first shipped routes.
- [ ] **TOOLS-02 Add coverage and code discovery tools.** `get_regulatory_coverage`, `list_legal_codes`,
  `list_legal_provisions`, aligned inputs and read-only annotations. Done: discover real IDs/unsupported scope; advertise
  only implemented capabilities. Local coverage and discovery tools are implemented with same-principal API identity;
  deployed and broader-data acceptance remains open. Depends on HTTP-04/10, TOOLS-01.
- [ ] **TOOLS-03 Add retrieval tools.** `search_regulations`, `get_legal_provision`, `get_legal_text`,
  `list_legal_passages`, `get_legal_passage`, preserving exact
  context through composed calls. No silent latest substitution or MCP-only ranking. Depends on HTTP-05–06/09, TOOLS-01.
  Local search/paging/text parity is recorded. `get_legal_provision` now calls the typed API with exact selection and a
  separately minted same-principal API credential. Passage list/detail tools now use the same typed API and identity,
  enforce edition/observation context and cap MCP list pages at ten passages. Broader scope and deployed acceptance remain open.
- [ ] **TOOLS-04 Enforce combined output budgets.** Include composed requests, warnings and continuation in the byte
  and 100,000-character ceilings. Done: deterministic continuation for large tables/documents, no limit bypass or silent
  evidence truncation. Depends on TOOLS-02–03.
- [ ] **TOOLS-05 Run the deployed API-backed model canary.** Real credentials and bounded persisted lexical/vector
  pilot; identical API/MCP IDs, citations, hashes, filters, dates, modes and paging; reject MCP tokens at API.
  Depends on HTTP-14/17, TOOLS-02–04/11, VECTOR-07 for semantic evidence; not EVAL-12 or bulk vectors.
- [ ] **TOOLS-06 Add publication/action tools.** `list_regulatory_documents`, `get_regulatory_document`,
  `get_regulatory_action`, preserving proposal/final/notice distinctions, agency filters, duplicate numbers and unresolved
  grouping. Depends on HTTP-08/12, TOOLS-01.
- [ ] **TOOLS-07 Add diff/relationship/event tools.** `compare_legal_versions`, `get_legal_relationships`,
  `get_legal_changes`; bounded paging and owner/version selection, including unsupported history, agree with HTTP.
  Depends on HTTP-12–13, TOOLS-01.
- [ ] **TOOLS-08 Test hostile source content and grounding.** Fake tool/system instructions and misleading legal-status
  text remain untrusted data, never executed or turned into uncited legal claims. Depends on TOOLS-03/06–07.
- [ ] **TOOLS-09 Verify rights and outage behavior.** Real client checks account isolation, mid-page revocation, expired
  capability, model outage and partial partitions, with safe HTTP-equivalent errors/fallback and no cached leakage.
  Depends on TOOLS-05–08.
- [ ] **TOOLS-10 Publish and verify the shipped tool catalog.** Examples, scope/unsupported cases and annotations must
  match deployed discovery and a complete research sequence. Depends on TOOLS-09, HTTP-15–16.
- [ ] **TOOLS-11 Verify the deployed lexical-only path.** Discovery, lexical search and exact text on an acknowledged
  pilot; wrong-account/audience and unavailable semantics retain HTTP parity with no vectors. Depends on HTTP-14,
  TOOLS-02–04, OPS-08. This is G2; TOOLS-05 adds G3 model evidence.

All remain full-scope gates, not claims of completion from local pilot results. See [the tool contract and retained
evidence](legal-tools.md).
