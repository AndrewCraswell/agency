# Open States extraction build

Build preparation is separate from runtime execution. The scheduled task must never download a mutable source ref,
resolve fresh dependency versions, or run the upstream database importer.

From `apps/legislation`, prepare a **new** output directory:

```powershell
python python/prepare_openstates.py artifacts/openstates-runtime/batched-build-inputs
```

The preparer checks the downloaded source archive against a fixed SHA-256 digest before extracting regular files.
It rejects links and path traversal, retains the complete upstream source archive and license, exports required main
packages from `poetry.lock` with version pins and distribution hashes, and writes `build-inputs.json` last.
It never overwrites an existing output directory. A failed preparation is not a deployable build.

Preparation applies reviewed exact-match source changes from `python/openstates_source_policy.py`: the NC events
scraper and shared HTML helpers require certificate verification, use 10-second connection and 60-second read
timeouts, and reject HTTP error responses. The insecure retry after a certificate failure is removed. Unexpected or
duplicate patch targets stop preparation. Original upstream bytes remain in the retained archive; generated source
hashes include the changes, and offline verification reapplies them. This is not proof that live upstream endpoints
will accept verified TLS or that a whole scrape will complete before the outer execution deadline.

Verify the prepared inputs offline before packaging:

```powershell
python python/prepare_openstates.py --verify artifacts/openstates-runtime/batched-build-inputs
```

Verification reconstructs the expected files from the retained archive after checking its pinned digest. It rejects
missing, additional, linked, or modified files, even if someone updated the candidate manifest to match the changes.
Generated files use UTF-8 and LF consistently so preparation on Windows and verification on Linux agree. This verifies
build inputs only; it does not verify installed Python packages or replace the later deployed-image startup checks.

The existing Windows machine-wide pip configuration selects the approved Microsoft Python feed. Docker does not
inherit it: explicitly pass the approved `PIP_INDEX_URL` to isolated package builds. Do not copy user credentials,
disable certificate verification, or silently fall back to a public registry. Source-only packages require a separately
pinned build toolchain; a successful metadata dry run is not a reproducible installed runtime.

Install the exported requirements using `pip install --require-hashes`; dependency resolution must succeed without
removing hashes, relaxing pins, bypassing TLS verification, or skipping dependency checks. Optional California
database dependencies are not enabled. Python runtime and system-library provenance, dependency installation,
jurisdiction startup checks, and request hardening remain separate deployment gates. The manifest deliberately records
`runtime_verified: false`: prepared source is not proof of a working image.

### Dependency metadata correction

The pinned `textract==1.6.5` wheel declares the invalid constraint `extract-msg (<=0.29.*)`; modern pip rejects it.
`python/prepare_openstates_dependencies.py` accepts only the original wheel's pinned SHA-256 and replaces that one
metadata declaration with `<=0.29`, exactly matching the retained upstream Poetry lock. It does not change executable
Python files, package versions, or license contents. It rebuilds the wheel RECORD, uses deterministic ZIP bytes and a
distinct wheel build tag, retains the original wheel, and records both hashes. Drift fails closed.

After downloading the original wheel through the approved feed, from `apps/legislation`:

```powershell
python python/prepare_openstates_dependencies.py artifacts/openstates-runtime/batched-build-inputs artifacts/openstates-runtime/textract-1.6.5-py3-none-any.whl artifacts/openstates-runtime/batched-dependency-inputs
python python/prepare_openstates_dependencies.py --verify artifacts/openstates-runtime/batched-build-inputs artifacts/openstates-runtime/batched-dependency-inputs
```

Install from the generated dependency directory: first `pip install --require-hashes -r bootstrap.txt`, then
`pip install --require-hashes --no-build-isolation -r requirements.txt`. The bootstrap pins setuptools from the same
upstream lock, avoiding unpinned build-isolation downloads for source-only packages. Finish with `pip check` and the
installed-runtime smoke test. A metadata repair is not a general dependency upgrade or a security audit.

The local acceptance Dockerfile is `python/Dockerfile`, with build context `apps/legislation`. It requires an explicitly
approved package index build argument and verifies both input bundles before installing. It is not a second production
orchestrator. Run its startup command with `--network none`; a live source canary is a separate acceptance gate.

Python 3.11 is the tested acceptance runtime. The pinned upstream `six==1.12.0` fails to import `six.moves` on Python
3.12 despite a successful dependency installation. The Dockerfile pins the Python 3.11 image by digest; do not replace
that gate with an unversioned Python installation. The deployed Trigger image must pass the same installed-runtime test.

The runner renames only upstream's known NC jurisdiction metadata filename to `jurisdiction_nc.json` before inventory,
because its colons are not portable to Windows. Payload bytes and source identifiers are unchanged. Existing-target
collisions, links, and other unsupported filenames are rejected. This prevents a successful Linux scrape from failing
the later TypeScript artifact handoff.

The executable NC pilot accepts only bill session `2025`. A live request to the `2025E1` filed-bill feed returned
1,092 Senate bills including July 2026 filings, so special-session routing is not accepted merely because its string
matches a session pattern. Historical rebuilding continues to use retained session archives. Additional runtime
sessions need explicit feed/session reconciliation before inclusion. Archived failed attempts remain readable.

Bill execution now also requires `bill_ids`: 1–10 unique identifiers such as `["S1091", "S1092"]`, from one chamber.
Events require `bill_ids: null`. Whole-session execution is rejected. The exact-match source policy checks that every
selected bill occurs exactly once in the feed before emitting bill data, then scrapes in numeric order. Missing or
duplicate selected source rows fail the attempt. New feed entries cannot shift an offset-based batch boundary.
The selected identifiers are retained with each attempt; retry the same identifiers, not an ordinal feed slice.
This bounds work per attempt but cannot guarantee source response time. The process deadline remains enforced.
Session-wide discovery, durable scheduling and the all-batches-complete checkpoint are still required before activation.
An extracted batch is never evidence that the whole session is complete.

The current Dockerfile defaults to `artifacts/openstates-runtime/batched-build-inputs` and
`artifacts/openstates-runtime/batched-dependency-inputs`. These are freshly generated from the retained, digest-verified
source archive using the current policy and dependency preparer. Earlier canary bundles remain unchanged evidence,
not current build inputs. Rebuild both bundles after a policy change; never edit their manifests to bless new bytes.

The runner writes `attempt.json` even if its subprocess cannot start. Exit-zero attempts with absent output, unexpected
files, links, or excessive output are rejected. Allowed `_data/nc/*.json` files receive byte counts and SHA-256 hashes.
The inventory is not semantic validation; `semantically_validated` remains false, and no canonical writes occur.
Timeout and nonzero-exit evidence is retained without forwarding raw child diagnostics into task logs. The final
uploader must verify these hashes again and archive failed attempts before cleanup. The runner's output limits are
64 MiB per file, 2 GiB total, and 100,000 files; these are rejection limits, not permission to promote partial output.

Retain an attempt using the existing `state-sources` Azure container, or an isolated local destination:

```powershell
node --env-file=.env --import tsx scripts/archive-openstates-scraper.ts <attempt-directory> azure <run-id>
```

The handoff validates the runner result, lane/session contract, duplicate paths, size bounds, and all listed file
checksums before publishing `retained.json`. Uploads are create-only and read back for verification. Identical retries
are accepted; conflicts and corruption are rejected. Failed and timed-out attempts remain failures in the archive.
The local reader rejects linked paths, and machine-local work-directory values are removed from archived metadata.
Replay verifies the retained run identity and every listed checksum. This marker proves retention of the declared
inventory, not source completeness or semantic validation. It never advances a canonical checkpoint or deletes local
evidence; those steps remain the responsibility of the validated ingestion transaction and orchestration layer.

Subprocess stderr is drained concurrently into a bounded 64 KiB tail and then discarded. Only a fixed diagnostic
category is retained (timeout, TLS, HTTP, parse, validation, or generic subprocess failure); source bodies, exception
messages, URLs, and credentials are not copied into the attempt report. The category is diagnostic evidence, not
permission to promote partial output or a guarantee that retrying will succeed.

Run `pnpm test:openstates-runner` for build-input and runner tests. Real process-group and symlink tests require Linux;
the network-disabled Docker test uses fixtures, not live legislative sources. See the
[rollout checklist](openstates-rollout-checklist.md) for remaining activation gates and evidence.
