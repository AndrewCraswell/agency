# RC-13 encrypted IR apparatus receiver

`src/encrypted-ir-apparatus-receiver.ts` is the app-local receive boundary between a physical IR adapter and RC-02 logical remote commands. It has no traffic keys and provides no cryptographic fallback. A target key-slot adapter must authenticate AES-256-GCM using the canonical IR AAD, derived nonce, ciphertext, and tag; `null` or an adapter failure is an authentication rejection.

The only supported plaintext is the two-byte direct-command codec:

| Byte | Meaning |
| --- | --- |
| 0 | Payload version `1` |
| 1 | One fixed direct, empty-payload command code |

The v1 code table is deliberately limited to direct referee handheld actions: score increment/decrement, clock toggle/adjust/load, penalty award, break start, undo, weapon selection, OPT modifier, rearm, and card reset. Modified, held, double-press, supervisor, snapshot, and parameterized commands do not have an encrypted payload representation in this slice and fail closed.

Each configured `IrLogicalRemoteBinding` is the explicit mapping from a cryptographic pairing identity to the RC-02 `remoteId`, paired-handheld controller, permission, and authority revision. The service rejects missing, duplicate, wrong-apparatus, wrong-epoch, and revoked bindings. Revocation is reported as `revoked-pairing`; other pairing failures are `wrong-pairing`. It never derives a logical remote identifier from bytes received over IR.

Receive ordering is fixed: parse frame, admit bounded ingress, verify pairing and epoch, authenticate/decrypt, decode payload, calculate replay/deduplication, commit in-memory replay state, then dispatch. A duplicate is not dispatched. A dispatch failure retains the replay commitment so an authenticated frame cannot be retried to repeat a side effect.

Construction preflights the whole options graph before reading it. It rejects accessors, hidden or symbol properties, nonplain and sparse containers, aliases, and cycles. Supplied replay and throttle state is independently cloned and frozen. A replay checkpoint must exactly match its binding's protocol, apparatus, remote identity, and epoch, and pass an accepted duplicate validation; an initial throttle checkpoint must have no outstanding queue work and be admissible. The returned `replayStates` are an explicit persistence handoff. The host application must restore them from a durable, atomic store before the next process starts; this TypeScript adapter does not claim hardware persistence, provisioning, physical optical performance, or independent security approval.
