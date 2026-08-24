# `rules-1` release record

M1-11 releases a bounded host scoring specification, not a hardware product.
The executable record is [`rules-1-release.ts`](../src/rules-1-release.ts).
It pins the reviewed source snapshot, the M1 evidence artifacts, the complete
three-weapon traceability set, and the required focused checks.

The record has no timing values. `timing-1` remains the only executable timing
source; this release binds its source and test digests rather than copying a
second timing table. A changed source digest requires a newly reviewed release
record, never a silent refresh.

## Scope

`rules-1` covers deterministic host behavior represented by M1-01 through
M1-10. It does not approve an FIE interpretation beyond the cited matrix,
analog acquisition, firmware, outputs, HIL, fabrication, compliance, or FIE
homologation. Favero material remains reference evidence only.

## Review handoff

The checked-in record is `approved-root` with `root-independent-reviewer` after
the root agent independently reviewed the pinned artifact diff and ran the
recorded checks. Any source change requires a new pending release review before
the release can be approved again.

The validator rejects missing, duplicate, extra, and out-of-order required
traceability or verification identities. It also rejects duplicate artifact
IDs or paths, malformed digests, stale release shape, incomplete M1 evidence,
and an approval state inconsistent with the root-reviewer requirement.
