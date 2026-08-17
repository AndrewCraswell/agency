# MCP evaluation readiness audit

## Scope

This audit separates locally automatable contract evidence from the live, authenticated, multi-client, and human review
required by phase D4 and milestones 10 and 14. The local harness is preparation evidence only. It does not change the
status of a release gate that explicitly requires the development corpus, WorkOS, a second client, or a human reviewer.

Run the credential-free evaluation from the repository root:

```text
pnpm --filter legislation eval:local
```

The command uses the production MCP handler, the official MCP SDK client, and a deterministic fixture service. It writes
an untracked evidence artifact to `apps/legislation/work/evaluation/local-mcp.json`. Set `LEGISLATION_EVAL_OUTPUT` to
another app-owned path when a separate artifact location is needed. No token, database, provider, cloud resource, or
environment-file change is required.

## Evidence captured locally

The artifact records the advertised tool surface, planned tool path, tool arguments, structured response evidence,
safe errors, per-call latency, assertion results, metric scores, task completion, and categorized failures. It exercises
all seven D4 tools and covers canonical identifiers, official links, chronological events, passage evidence, version
comparison, explicit relations, empty results, pagination, truncation, and malformed-input behavior.

The artifact identifies itself as `local-fixture-mcp-contract-evaluation` and always states these limitations:

- Authentication is disabled.
- The corpus is deterministic fixture data rather than the live development corpus.
- Only one MCP client implementation is involved.
- Client-authored final answers, unsupported claims, and human source review are not scored.

## Unchecked-task audit

| Task | Automated readiness | Remaining release evidence |
| --- | --- | --- |
| D4.1 | All seven tools are exercised through Streamable HTTP locally. | Run all seven with authentication against nonempty live development data. |
| D4.2 | Assertions cover identifiers, official links, pagination, truncation, empty results, and safe errors. | Repeat the assertions against representative live records and retain the artifact. |
| D4.3 and M14.28 | The artifact schema retains calls, arguments, evidence, latency, and failures. | Run the prompt set through the already-connected agent client and retain its final answers and citations. |
| D4.4, M10.27, and M14.27 | The harness makes tool-contract drift visible. | Use two independently supported MCP-capable clients through WorkOS staging. Two sessions of the same SDK do not satisfy this gate. |
| D4.5 and M14.29 | Deterministic assertions score retrieval, passages, comparisons, relations, source use, and task completion. | Score agent answer correctness and unsupported claims over live results. |
| D4.6 and M14.30 | The artifact exposes official URLs and expected evidence for review. | A human reviewer must compare the stratified sample with official records. |
| D4.7 and M14.31 | Failures use the D4 taxonomy: corpus, normalization, processing, retrieval, tool contract, authentication, client, or evaluation. | Triage failures produced by the live two-client run. |
| D4.8 and M14.32 | Affected cases can be rerun locally after a fix. | Fix any live release blocker and rerun its slice in both clients. |
| D4.9 and M14.33 | The JSON artifact provides a reproducible local baseline format and explicit limitations. | Publish the final live baseline, compatibility record, and known limitations after the preceding gates pass. |

No item above should be checked solely because the fixture-backed command passes.
