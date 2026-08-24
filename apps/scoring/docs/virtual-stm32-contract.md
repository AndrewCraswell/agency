# Virtual STM32 shell contract

**Contract:** M2-03

`createVirtualStm32` is a deterministic, bounded host model of the STM32 scoring authority. It selects one approved
weapon identity and immutable timing-table revision when it is created. Unknown timing-table revisions fail closed;
there is no default or application-supplied timing value.

## Authority boundary

The caller provides one STM32-owned `VirtualStm32WeaponScorer`. Its `advance` function is the only path that can return
an authoritative outcome. The shell wraps that value with its scoring-clock timestamp, selected weapon, selected timing
table revision, and `source: "weapon-scorer"`. It has no API to submit an outcome, decision record, hit, rejection,
lockout, or application command.

The optional observer receives already-authoritative outcomes synchronously. It cannot replace, suppress, alter, or
create an outcome. Transport, ESP32 receipt, application requests, decision-record capture, persistence, retries, and
firmware SDK behavior are outside this task.

The scorer is weapon-neutral at this boundary: the shell imports no epee contact or resistance types. A weapon scorer
receives canonical [`VirtualFrontEndSnapshot`](../src/virtual-front-end.ts) values and owns the selected weapon's
phase-completeness projection. M1-08 will make those adapters consume the selected timing-table values while it updates
the existing scoring modules in one coordinated change.

## Clock, trust, and bounds

`ingestSnapshot` schedules the scoring step at the snapshot's `atUs` on the explicit virtual clock, then advances that
clock to the same instant. Snapshot timestamps must be monotonic and cannot precede the virtual clock. No host time,
host timer, asynchronous scorer, or asynchronous observer is accepted.

Only a snapshot accepted by M2-02's `validateVirtualFrontEndSnapshot` is accepted. This verifies nested phase,
relation, provenance, resistance, fault, contradiction, trust, and transition evidence. The shell resolves that phase
through M2-02's reviewed phase registry; a canonical snapshot for a different weapon is consumed as
`ignored-unselected-profile`, without invoking the scorer or emitting an outcome. An `indeterminate` or `unavailable`
snapshot for the selected profile is consumed as `ignored-untrusted`, also without invoking the scorer or emitting an
outcome. This fails closed until M2-04 adds explicit capture records for such evidence.

The shell accepts at most 100,000 snapshots by default, configurable from 1 through 1,000,000. It stores no outcome
history and therefore does not become a substitute for M2-04 event capture or M2-08 persistence. Reentrant submission
while a scorer or observer is running is rejected.

An emitted outcome is cloned and deeply frozen before its observer sees it. The bounded snapshot accepts only plain
objects, arrays, strings no longer than 512 characters, finite numbers, booleans, and null. It rejects accessors,
cycles, non-plain objects, more than 128 values, or nesting deeper than eight objects/arrays. Arrays must have only
canonical own data indices: sparse arrays, extra keys, symbols, and accessor indices are rejected. Object properties
are copied from data descriptors, including a literal `__proto__` key, without invoking getters or changing the clone's
prototype.

State, timestamp, count, and the single `lastReceipt` are committed before an observer runs. If an observer throws,
reenters, or returns asynchronous work, that already-decided receipt remains committed and the shell enters
`isUnavailable`. Later snapshot intake fails closed, so it cannot replay against advanced scorer state. A scorer state
factory must also complete synchronously.

## Acceptance

`src/virtual-stm32.test.ts` proves timing/weapon selection, reviewed M2-02 weapon-profile selection, virtual-clock
ordering, deterministic replay, nested front-end forgery rejection, trusted-input scoring, fail-closed untrusted or
wrong-profile input, bounds, invalid configuration, deeply immutable outcomes, observer-failure finality, and that
outcomes can originate only from the weapon-scorer return path.
