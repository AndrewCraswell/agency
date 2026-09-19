# Open States content continuation

Archive imports and content completion are separate gates. The content controller processes bounded sequential
batches for an exact state/session. At its child-count budget or after ten minutes between children, it submits one
idempotent successor using the same state/session and batch limits. Extraction repairs are not replayed by successors.
The two-hour worker limit leaves headroom inside the four-hour controller limit even for a slow final child.

After a full bill scan and all carried embedding work, the worker checks canonical document state using the indexed
jurisdiction/session bill scope. Due extraction/OCR continues; future retries use a delayed successor. In-flight
documents receive a one-minute recheck. Exhausted attempts, missing OCR artifacts and failed documents are reported
as blocked when other work has drained, not silently counted as complete. Terminal unsupported formats are retained
as exclusions. A drained scan stops without repeating another 100 rounds.

`ingestionComplete` remains false: these decisions do not certify source coverage, document exclusions, lexical
replication or API/MCP search acceptance. Final audit is still required.

Resume only sessions whose existing controllers have finished; do not create overlapping chains. Existing deployed
controllers retain their old behavior and must be inspected separately after deployment. Database job leases and
publisher host limits remain unchanged. Queue capacity is not proof of provider or database capacity.
