# Partial Open States people imports

Recorded verification (September 15): full `pnpm verify` passed for this implementation, including 2,820 legislation tests
and four receiver tests; 108 conditional tests skipped. This is not current repository health or production acceptance.

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
invalid timestamps before database access. Production promotion and recurring retry orchestration remain open acceptance work.

Partial persistence preserves unobserved people and term history and disables organization replacement. Quarantined
people and their relationships are untouched; no term-deletion scope is supplied. Database failures still roll back the
transaction, rather than being swallowed as source quarantine. Empty accepted sets never reach persistence. This narrowly
supersedes older whole-roster rejection for additive people/history imports, not directory replacement or activation gates.

Alaska retained-archive application and replay on September 14 in local `legislation_test`: 164 accepted people,
271 stored terms, four quarantined people and identical term IDs after replay. No production writes. Structural
validation does not establish that all accepted historical assertions are factually correct.

- [x] Shared NC/Alaska application and state-scoped checkpoint.
- [x] Archive-pair jurisdiction, revision, lane and timestamp checks.
- [x] Eighteen focused importer/quarantine/pairing tests.
- [x] Twenty-two real PostgreSQL integration tests, including both states and corrected-source replay.
- [x] Actual Alaska archive application and idempotent replay in the local test database.
- [x] Local HTTP collection and detail acceptance: two pages, 164 people and 271 canonically mapped terms.
- [ ] Production promotion, recurring retry orchestration and API/MCP acceptance.

Person-detail acceptance: the shared importer retains the normalizer's profile and jurisdiction rows for accepted
people, preserving supplied name/image/link fields. Office titles come from each state profile's chamber configuration,
not individual-name exceptions. Unknown dates remain unknown. `pnpm exec tsx scripts/smoke-openstates-people.ts ak`
uses `LEGISLATION_TEST_DATABASE_URL`, restricted to local `legislation_test`, and checks all collection pages and person
detail mappings over HTTP. It does not establish hosted authentication, MCP, committee completeness or production health.

People-detail acceptance included 20 focused and 22 PostgreSQL tests plus retained Alaska HTTP checks for all 164 people
and 271 terms. Earlier unrelated Knip, shared-coverage, build-lock and timeout failures were superseded by the passing
run above; they are not outstanding people-import defects. Broader/current source acceptance belongs to the
[state rollout](openstates-rollout-checklist.md).
