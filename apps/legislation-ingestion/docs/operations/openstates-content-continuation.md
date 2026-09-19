# Open States content continuation

Archive imports and content completion are separate gates. The content controller processes bounded sequential
batches for an exact state/session. At its child-count budget or after ten minutes between children, it submits one
idempotent successor using the same state/session and batch limits. Extraction repairs are not replayed by successors.
The two-hour worker limit leaves headroom inside the four-hour controller limit even for a slow final child.
Children and successors are locked to the parent deployment version. A later deployment cannot silently replace
the continuation contract halfway through a chain. To adopt a newer version, use an explicit handoff after the old
chain drains or is deliberately stopped; deploying alone does not upgrade existing chains.

After a full bill scan and all carried embedding work, the worker checks canonical document state using the indexed
jurisdiction/session bill scope. Due extraction/OCR continues; future retries use a delayed successor. In-flight
documents receive a one-minute recheck. Exhausted attempts, missing OCR artifacts and failed documents are reported
as blocked when other work has drained, not silently counted as complete. Terminal unsupported formats are retained
as exclusions. A drained scan stops without repeating another 100 rounds.

`ingestionComplete` remains false: these decisions do not certify source coverage, document exclusions, lexical
replication or API/MCP search acceptance. Final audit is still required.

Resume only sessions whose existing controllers have finished; do not create overlapping chains. For an active
controller on an earlier deployment, set `resumeAfterRunId` on exactly one successor. It validates the predecessor's
task and state/session, durably waits for successful completion, then drains the remaining backlog. Failed predecessors
require investigation. Ordinary successors remove this handoff field. Database job leases and
publisher host limits remain unchanged. Queue capacity is not proof of provider or database capacity.

## September 19 production verification

Trigger deployment `20260919.2` contains the continuation fix and guarded predecessor handoff. The NC 1991 canary
`run_06gbep86d69u0mif9vkdqbu201` completed its five-batch budget and submitted successor
`run_06gbeq040ur589rvkorl5s5c01`, observed executing. The already-drained NC 2003E3 canary
`run_06gbep8gqbcbfeh12hk4plq501` stopped after one scan with no successor. Neither claimed ingestion/search completion.

Nine stopped regular-session controllers were resumed (1985 through 2001, odd years). Twelve remaining active
controllers from the previous archive round received idempotent successors with `resumeAfterRunId`; these do not
start content children until their exact predecessors succeed. At 02:06 UTC the unchanged 16-worker queue had 16
running and five queued tasks. PostgreSQL used 43 of 100 connections with no lock waits older than ten seconds;
the previous ten minutes contained 336 successful content batches and no failed batches. These are dated observations,
not final corpus acceptance or a throughput guarantee.
