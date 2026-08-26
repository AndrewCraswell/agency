# C17 scoring semantic inventory

**Task:** CW-02
**Machine-readable inventory:** [`c17-scoring-semantic-inventory.json`](c17-scoring-semantic-inventory.json)
**Check:** `pnpm --dir apps/scoring check:semantic-inventory`

## Ownership rule

Every production TypeScript source has exactly one ownership row, and every
branch in that source is owned by the row's policy. A `c17-core` row moves its
behavior into the C17 core under the listed successor tasks. An `adapter` row
is constrained by its explicit allow and prohibit statements; it may normalize,
validate, transport, orchestrate, or project a receipt, but it may not preserve
a second scorer.

The machine artifact binds each listed source to a normalized-source SHA-256,
an AST-derived branch count, and a digest of stable decision IDs:
`function-anchor:ast-kind:ordinal:predicate-sha256-16`. Those IDs are
line-independent and cover conditionals, switches, full logical guards, and
loop guards. A source change fails before approval; changing its source digest
alone still fails when the branch signature changes. The checker also
recomputes the reverse-import closure from each current C17-core source, so an
indirect consumer cannot be omitted. Runtime module edges include imports,
re-exports, literal dynamic imports, and literal `require` calls; type-only
edges are excluded, and TypeScript file and index resolution are checked
against the sealed source set. An unresolved dynamic or `require` specifier
fails closed. The production TypeScript source set is also
sealed: any new source fails until the inventory is reviewed, while scoring
signatures in an existing source fail until explicitly owned. There is no
unfingerprinted ownership tail: the checker requires the ownership-row source
set to equal the sealed production-source set, and independently verifies the
source digest, branch count, and branch-signature digest of every row.

The inventory deliberately captures the present TypeScript reference behavior
and every direct runtime consumer. This is an implementation inventory, not a
claim that the C17 core exists yet or that TypeScript is an acceptable shipping
fallback. It also includes scenario normalization, temporary vector and
property tooling, virtual STM32, lifecycle, display, security, normalized-schema,
hardware-contract, and evidence modules because their branches can otherwise
smuggle scoring behavior across the future ABI.

`src/device.ts` is a retired production source under SD-002. The inventory
fails closed if it reappears, even if a future edit attempts to add it back to
the general production source set.

## Clean-checkout boundary

The checker binds the filesystem it is run against; a passing dirty-worktree
check is not evidence of a committable CW-02 unit. The current inventory binds
simulator, encrypted-IR, security, normalized-schema, hardware-contract, and
evidence sources that may be pending worktree files, so it cannot independently
support approval or closure unless every bound source and the inventory/checker
changes are included in one coherent commit. The closing review must re-run both
checks from that clean checkout. A future pending-overlay format would need its
own fail-closed base-commit identity and may not approve CW-02 while any overlay
remains.

## Boundary by policy

| Policy | Current sources | Future responsibility |
| --- | --- | --- |
| `c17-core` | Current TypeScript reference behavior for epee, resistance, foil, foil insulation/evidence, sabre, timing profile, and the epee contact kernel | Migrates into one heapless C17 implementation and generated profile |
| `adapter` | All remaining production TypeScript: lifecycle, virtual STM32/ESP32 and processor link, scenario normalization/runner and CLI, vectors, property harness, display, transport, security, normalized schema, hardware contracts, canonical-data utilities, and evidence | After CW-16/CW-17, canonical bytes and receipts only; never a TypeScript scoring fallback and fail closed if the C17/Wasm core is unavailable |

`CW-03` freezes the normalized data model, `CW-05` replaces copied timing
constants, and `CW-19B` deletes the temporary TypeScript scoring paths. The
inventory is an ownership boundary, not a claim of C17 parity or independent
conformance evidence. The adversarial check is
`pnpm --dir apps/scoring test:semantic-inventory`.
