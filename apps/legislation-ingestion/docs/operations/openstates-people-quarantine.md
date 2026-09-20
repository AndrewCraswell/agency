# Partial Open States people imports

Source errors must not block unrelated valid people. Preparation validates each person's entire history before
producing canonical rows. Malformed YAML/identity/metadata, invalid or reversed dates, overlapping periods, unclosed
retired roles, ambiguous current roles/parties and indistinguishable term identities quarantine that person. Duplicate
source identities quarantine all copies, independent of file order. No name-specific corrections run.

The conservative unit is a person, not a role: accepting only remaining roles could incorrectly change active status
or aliases. Unknown dates remain null. Partial-precision dates remain in the raw archive and quarantine the person until
canonical precision support exists. Plausible but factually wrong dates cannot be detected by structural validation alone.

Quarantine entries contain source path, SHA-256 and reason codes. Returned reports and atomic checkpoints retain them.
Partial checkpoints have `complete: false`, never proof of complete coverage. Corrected-source replay re-evaluates the
person without a permanent denylist. The same application command now supports NC and Alaska, selecting the jurisdiction
and checkpoint stream from checksum-verified archives. Pairing rejects different states/revisions, swapped lanes and
invalid timestamps before database access. Production promotion and recurring retry orchestration require the shared rollout gate.

Partial persistence preserves unobserved people and term history and disables organization replacement. Quarantined
people and their relationships are untouched; no term-deletion scope is supplied. Database failures still roll back the
transaction, rather than being swallowed as source quarantine. Empty accepted sets never reach persistence. This narrowly
supersedes older whole-roster rejection for additive people/history imports, not directory replacement or activation gates.

The shared importer retains accepted profile and jurisdiction rows, including supplied name, image, and link fields.
Office titles come from the jurisdiction's chamber configuration, not person-specific exceptions. Validate archive-pair
jurisdiction, revision, lane, and timestamp agreement before database access.

Acceptance requires focused importer tests, guarded PostgreSQL replay, stable term identities, complete quarantine
reporting, and W/M person-detail checks. These checks establish only the tested cohort. Broader source, committee,
production, and recurring acceptance belongs to the [state rollout](openstates-rollout-checklist.md).
