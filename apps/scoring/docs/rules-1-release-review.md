# `rules-1` independent release review

**Task:** M1-11
**Review date:** 2026-08-22
**Reviewer role:** independent specification judge
**Verdict:** **APPROVE `rules-1` host scoring-specification release**

## Decision

The host rule modules are deterministic, fail closed for their declared
logical inputs, and have focused unit evidence. The generated M1-08 suite
exercises every selected runtime timing boundary below, at, and above its
value for both sides and all three weapons. The reviewed R-02 ledger correction
at `5ea3e70` now records the committed M1 host evidence and retains every
physical and later-stage gate. The stated M1-11 acceptance criteria are met.

This is a deliberately narrow approval. It does **not** establish analog work,
hardware, a new timing policy, a new FIE interpretation, an expanded
emulator, foil or sabre golden-scenario files, or a scenario-runner CLI before
releasing the host scoring specification. It also does not establish target
firmware, primary outputs, HIL, EVT, DVT, compliance, fabrication readiness,
production readiness, or FIE approval.

## Independent source review

The local FIE PDF was checked directly. Annex B pages 77 through 82 contain
the foil, epee, and sabre rules cited by the traceability matrix. In
particular, page 80 states the epee 2--10 ms normal-resistance test, the
100-ohm exceptional case, the less-than-40 ms and greater-than-50 ms double
hit guarantees, and grounded-material non-registration. Pages 77--79 state
the foil 13--15 ms and 300 ms plus or minus 25 ms requirements. Pages 81--82
state the sabre 0.1--1 ms test point, 170 ms plus or minus 10 ms event
window, blade-history conditions, and B/C control-break requirement.

The local Favero FA-15 material is treated as prior art only, consistent with
the reference-capture contract. Its T2016 timing sheet is aligned with the
same broad published timing bands, but it does not supply authority for a
project endpoint, threshold, or release claim. The FA-15 5 V supply and its
homologation certificate do not affect this host-rule release decision.

## Deliverable checklist

| ID | Independent finding | Release status |
| --- | --- | --- |
| M1-01 epee audit | The audit identifies the FIE source, distinguishes the selected 45,000-us policy from an FIE endpoint, and direct tests cover contact, ground, ordering, and timing boundaries. | Pass at host-rule scope. |
| M1-02 epee resistance | Exact 10-ohm and 100-ohm logical cases, grounded material, unsafe inputs, simultaneous contacts, and near-lockout behavior have direct tests and active epee scenarios. | Pass at host-rule scope. |
| M1-03 foil state machine | Contact-break, target classification, faults, containment, and lockout have direct both-side tests. The contract correctly keeps physical acquisition outside this layer. | Pass at host-rule scope. |
| M1-04 foil insulation | The 200-ohm policy and the unresolved 450--475-ohm band are explicit and fail closed. The code does not turn a diagnostic into a hit. | Pass at host-rule scope. |
| M1-05 sabre state machine | Target, diagnostics, whipover history, interruption count, recovery, and lockout have direct tests. The provisional 5,000-us/20,000-us policy is labelled as a product choice, not FIE text. | Pass at host-rule scope. |
| M1-06 bout state | Supervisor-authorized reset and weapon-change transitions create fresh weapon-specific scorer state and tests cover leakage prevention. | Pass. |
| M1-07 timing table | `timing-1` is immutable, strict, and fails closed for unknown or altered tables. The selected values remain visibly product choices where FIE gives a band. | Pass. |
| M1-08 boundary suite | The generated suite executes 54 runtime below/at/above vectors and retains 26 non-normative references for both sides. Its separate golden-corpus identity resolver permits only the currently committed epee corpus and fails closed for future identities. | Pass. |
| M1-09 properties | Seeded determinism, symmetry, monotonic-time rejection, no-hit safety, and reset/weapon-change properties are reproducible and pass. | Pass. |
| M1-10 reference capture | The schema-valid example and signed-measurement guard pass. The contract correctly prevents a Favero observation from becoming a rule. | Pass. |
| M1-11 release | The reviewed ledger records the completed M1 host evidence and its remaining physical/later-stage gates; focused and full scoring verification pass. | **Pass.** |

## Release closure

The previous sole release blocker was the R-02 ledger status. Commit `5ea3e70`
corrected it by recording M1-02 through M1-10 host evidence, the independent
M1-11 review state, and the still-open analog, acquisition, firmware, output,
HIL, EVT, DVT, production, fabrication, and approval gates. This resolves the
written M1-11 ledger criterion without promoting host tests into hardware or
approval claims.

## Recommended follow-on work, not a `rules-1` release gate

The current canonical golden manifest is intentionally epee-only. Adding foil
and sabre scenario files, approving their future rule identities, and building
the scenario-runner CLI belong to corpus and replay work, particularly M2-12.
That runner should execute scorers and compare their output with scenario
expectations. Later stored-record replay must render the immutable recorded
decision without re-deciding the scoring algorithm. EPEE-05 output/audio also
remains accurately deferred until there is an executable host output contract.

## Validation evidence

The following checks were run at the review revision:

| Check | Result |
| --- | --- |
| Nine M1-focused Vitest files | Pass: 263 tests. |
| `pnpm --filter scoring check:types` | Pass. |
| M1-file-only `oxlint --max-warnings=0` | Pass. |
| `pnpm --filter scoring check:unused` | Pass. |
| Reference-machine comparison schema and example | Pass. |
| Reference measurement signed-unit guard | Pass. |
| Golden manifest paths and declared identities | Pass: 22 active host scenarios across epee, foil, and sabre. Composite traceability rows remain planned wherever the active vectors provide only partial evidence. |
| `pnpm --filter scoring verify` | Pass: formatting, lint, type check, unused-export check, and 18 Vitest files with 330 tests and 100% statement, branch, function, and line coverage. |

This host scoring-specification approval does not claim analog acquisition,
output hardware, target firmware, transport, EMC, reliability, fabrication,
FIE approval, or product release readiness.
