# Open States extraction runtime

Build preparation is separate from extraction, archival, canonical promotion, and schedule activation. A scheduled
task must never download a mutable source ref, resolve fresh dependency versions, or run the upstream database importer.
Use the [rollout requirements](openstates-rollout-checklist.md) for end-to-end acceptance and the
[jurisdiction onboarding runbook](openstates-jurisdiction-onboarding.md) for source-specific work.

## Build inputs

Run commands from `apps/legislation-ingestion`. Create a new output directory; preparation never overwrites an existing
bundle.

```powershell
python python/prepare_openstates.py artifacts/openstates-runtime/build-inputs
python python/prepare_openstates.py --verify artifacts/openstates-runtime/build-inputs
```

To rebuild without network access, supply the retained upstream archive:

```powershell
python python/prepare_openstates.py --archive <retained-upstream.tar.gz> artifacts/openstates-runtime/build-inputs
```

Preparation:

- verifies the pinned upstream revision and archive checksum;
- rejects links, path traversal, unexpected files, and duplicate patch targets;
- applies only the reviewed exact-match changes in `python/openstates_source_policy.py`;
- exports pinned requirements and distribution hashes from the upstream lock;
- retains the upstream archive and license; and
- writes `build-inputs.json` only after the bundle is complete.

Offline verification reconstructs the expected tree from the retained archive. It rejects missing, added, linked, or
modified files even if a candidate manifest was edited to match. A verified input bundle is not proof of an installed
or operational runtime.

## Dependency inputs

Use the approved Python package feed and do not copy user credentials into the build context. The dependency preparer
accepts only the pinned `textract==1.6.5` wheel and applies the reviewed metadata correction needed by modern pip.

```powershell
python python/prepare_openstates_dependencies.py artifacts/openstates-runtime/build-inputs <textract-wheel> artifacts/openstates-runtime/dependency-inputs
python python/prepare_openstates_dependencies.py --verify artifacts/openstates-runtime/build-inputs artifacts/openstates-runtime/dependency-inputs
```

Install `bootstrap.txt` and then `requirements.txt` with `pip install --require-hashes`; the second install also uses
`--no-build-isolation`. Finish with `pip check`. Do not relax hashes, bypass TLS verification, permit an unreviewed
package index, or treat the metadata correction as a dependency upgrade or security audit.

## Image and startup verification

`python/Dockerfile` is the local acceptance image. It pins Python by digest, verifies both input bundles before
installation, and requires the approved package index through `APPROVED_PYTHON_INDEX`. Keep its build context at
`apps/legislation-ingestion`.

Run the image's default startup smoke with `--network none`. A live source canary is a separate acceptance gate.
The deployed Trigger image must pass the same installed-runtime checks. Rebuild both bundles after a source-policy,
upstream-revision, lockfile, or dependency-policy change; never edit retained manifests to bless different bytes.

The Dockerfile is not a second production orchestrator. Trigger.dev owns hosted execution, while the application owns
normalization, checkpoints, leases, archival, and canonical transactions.

## Runtime boundary

The runner accepts one bounded, explicit payload and records `attempt.json` even when its child process cannot start.
Bill batches contain 1–10 unique bill identifiers from one chamber. Event batches use explicit event keys. Whole-session
execution and offset-based batch identities are rejected.

The runner:

- verifies the build-input fingerprint against a separately supplied approved value;
- checks that every selected source record occurs exactly once;
- preserves source URLs, source identifiers, dates, and unknown values without inference;
- enforces a process deadline and bounded output size;
- rejects links, unexpected files, missing output, duplicate output, and nonzero exits; and
- records only bounded diagnostic categories, never source bodies, request URLs, credentials, or raw child errors.

An exit-zero attempt is still untrusted until archive and semantic validation pass. Runner output never writes canonical
records directly.

## Archival and promotion

The shared archive writer validates the attempt, lane/session contract, path set, size bounds, and every checksum before
publishing `retained.json` to the configured state-source store. Uploads are create-only and read back for verification.
Identical retries are accepted; conflicts and corruption fail. Failed and timed-out attempts remain failures in the
archive.

Canonical promotion requires a verified retained archive, approved build fingerprint, exact scope, and valid ownership
lease. Promotion and its immutable receipt commit in one transaction. An identical receipt makes replay a no-op; a
conflicting receipt fails. Extracted or archived output alone does not establish completeness, semantic validity,
canonical promotion, or schedule readiness.

## Ownership and recovery

Scraper attempts require confirmed release. Expiry prevents promotion but does not authorize takeover while the prior
owner remains unreleased. The executor must verify that the original process or container cannot resume before releasing
the matching token.

For local guarded recovery:

```powershell
pnpm tool openstates/recover-openstates-attempt <held-run-id>
```

The command is restricted to the disposable local `legislation_test` database. It refuses live or uninspectable
processes, mismatched hosts or Docker daemons, missing provenance, remaining run-labeled containers, and changed
ownership tokens. It does not stop processes or containers. Hosted recovery requires authoritative Trigger.dev runtime
evidence; local PID checks are insufficient.

## Verification

Run the Python build-input and runner suite:

```powershell
pnpm --filter legislation-ingestion test:python
```

Real process-group and symlink coverage requires Linux. Network-disabled image tests use fixtures, not live legislative
sources. Complete rollout acceptance also requires bounded extraction, archive readback, canonical replay, relationship
reconciliation, interruption recovery, downstream W/M checks, and live schedule inspection as defined by the
[rollout requirements](openstates-rollout-checklist.md).
