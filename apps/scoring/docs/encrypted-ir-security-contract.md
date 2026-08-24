# Encrypted IR security contract

## Status

`RC-03` selects a candidate wire-security profile, but release remains
**DENY** until an independent security review approves the cryptographic
implementation, pairing/provisioning procedure, persistent-storage failure
handling, hardware receiver path, and target measurements. This document does
not authorize fabrication, production provisioning, or plaintext operation.

## Selected candidate

The only operational suite is `AES-256-GCM-96N-128T`: AES-256-GCM with a
96-bit nonce and a 128-bit authentication tag. The receiver accepts only
`fencing-ir` protocol version 1 and that exact suite identifier. It never
negotiates, downgrades, guesses an algorithm, accepts a truncated tag, or
provides an unauthenticated diagnostic command path.

The encrypted plaintext is a bounded, deterministically encoded command body:
the RC-02 command key and its bounded payload. The body is not executable
until it decodes as the exact RC-02 `RemoteCommand` shape. The authenticated
associated data is the exact binary header containing product/protocol identity,
protocol version, suite, apparatus identity, remote identity, key epoch,
counter, command identifier, press kind, and ciphertext length. Command
identity and routing can therefore not be moved between a paired remote,
apparatus, suite, epoch, or press kind.

The eventual target codec uses RFC 8949 core deterministic CBOR with
definite-length values only. Its command-body field map, command-key numeric
assignments, and command-body vectors are intentionally deferred to the independently
reviewed target implementation rather than improvised in the reducer.

Canonical v1 header/AAD bytes are ordered exactly as follows: ASCII `IR`
(`49 52`), ASCII `FSIR` (`46 53 49 52`), protocol version `01`, suite code
`01`, 16-byte apparatus identity, 16-byte remote identity, unsigned four-byte
key epoch, unsigned eight-byte counter, 16-byte command identifier, press-kind
code, and one-byte ciphertext length. Multi-byte integers are big-endian.
Press-kind codes are direct `01`, modified `02`, held `03`, and double `04`.
The 70-byte header is the complete AES-GCM AAD. Ciphertext follows it, then the
16-byte tag. The executable serializer/parser and fixed byte vector reject any
unknown marker, version, suite, press code, non-canonical length, or extra byte.

The raw operational frame is bounded to 150 bytes: two-byte magic, four-byte
product/protocol marker, version, suite identifier, 16-byte apparatus identity,
16-byte remote identity, four-byte epoch, eight-byte counter, 16-byte command
identifier, press kind, ciphertext length, up to 64 ciphertext bytes, and a
16-byte tag. The receiver queue holds at most four frames. It admits at most
24 candidate frames per syntactically valid raw remote identity per second and
64 globally per second;
excess is dropped with bounded rate-limited diagnostics and never reaches the
bout reducer or STM32.

`src/encrypted-ir-security.ts` makes that 150-byte accounting and the fixed
queue/rate limits executable in the host contract. The target receiver must use
the same policy before allocating cryptographic work. The host throttle is not
evidence of target timing, optical throughput, paired identity, or flood
resistance. Its remote identity is an untrusted raw-header rate bucket; active
pairing is checked only after the future cryptographic adapter authenticates the
header.

## Nonce, retransmission, and replay

For one pair key and epoch, the 96-bit GCM nonce is the big-endian concatenation
of the four-byte epoch and an eight-byte monotonic counter. Operational counter
zero is forbidden. This profile imposes a conservative per-epoch ceiling of
`0x00000000ffffffff`; exhaustion blocks transmission and requires a controlled
new key epoch. A new epoch always has a fresh, independent 256-bit traffic key;
changing an epoch label without changing the key is forbidden.

Before emitting a frame, the remote writes and verifies the next counter in an
inactive durable slot, then atomically marks it current. It encrypts once and
caches the serialized frame for redundant optical bursts. A retransmission is
byte-identical: it must never perform another GCM encryption using the same
nonce. A lost battery, reset, interrupted write, or firmware update may lose a
pending command but must never reuse a counter. If no verified counter record
survives, the remote is unavailable for operational transmission rather than
starting from zero or selecting a random fallback.

The apparatus's reviewed target adapter authenticates and decrypts with the
selected library before it may call the replay-transition helper. The helper is
not an acceptance API and cannot dispatch a command. It only calculates and
deep-freezes a non-authoritative candidate next state: apparatus
identity, remote identity, key epoch, protocol, suite, high-watermark, and an
ordered 4,096-entry `(commandId, counter)` ledger. State for a different pair,
epoch, protocol, or suite is unavailable. Sparse arrays, accessors, duplicate
identities/counters, non-monotonic counters, and a high-watermark inconsistent
with the ledger fail closed.

The host contract cannot attest to the provenance of a JavaScript caller.
Accordingly, it has no caller-supplied `authenticated` flag or equivalent
claim, rejects an extra authentication field, and labels every receipt
`not-proved-by-this-contract`. Candidate metadata is useful only for exercising
the pure replay calculation; it is never evidence of AES-GCM success. The
future target adapter must keep authenticated plaintext and replay transition
in one reviewed boundary.

Only the future target adapter may durably commit and read-back/confirm that
candidate state. Dispatch remains forbidden until both AES-GCM authentication
and the durable replay commit have succeeded. The pure helper performs no I/O
and makes no persistence, authentication, or dispatch claim.

An exact retained retransmission produces a duplicate result and no dispatch.
Any lower or equal counter not matching that retained pair is replayed; a
remembered command identifier with a different counter is rejected. The ledger
never evicts a command identity. At its 4,096-entry capacity, fresh commands
are blocked until an explicit audited lifecycle reset under a new pairing/key
epoch; they are never silently accepted under a reused command identifier. A
power failure after the replay commit can lose availability, but cannot execute
a command twice.

## Pairing, custody, and service boundary

Pairing is a local, physically authorized, audited service operation, not an
operational IR frame. The selected service model writes a freshly generated,
unique 256-bit traffic key for one `(apparatus identity, remote identity, key
epoch)` into the remote's approved protected storage and an ESP32 protected
credential slot. There is no fleet key, universal default, development key in a
release image, in-band pairing, key export in diagnostics, or production secret
in source control.

Replacement, key rotation, counter recovery, lost-remote response, and secure
factory reset create a new epoch/key or revoke the existing pairing. A revoked
pair cannot dispatch a frame. A partial pairing/provisioning write leaves the
pair non-releasable and operationally unavailable until an audited recovery
procedure completes. The factory receives only the scoped programming/test
authority needed for its station; release signing and root-key custody remain
separate.

The ESP32-S3 candidate uses the ESP-IDF-supported Mbed TLS/PSA cryptographic
path with AES-GCM enabled, production Secure Boot v2, release-mode flash
encryption, and NVS encryption or an equivalently reviewed encrypted persistent
credential/replay store. Exact ESP-IDF version, API calls, secure-element choice,
remote MCU protected storage, pairing transport, persistence journal, and
hardware fault behavior remain review gates. Flash encryption alone is not
accepted as the operational AEAD key-management solution.

## Executable gate

`src/encrypted-ir-security.ts` provides only a pair-bound replay-transition
helper and an ingress throttle. It rejects unsupported envelope shape, identity,
epoch, revocation, counter reuse, command-id reuse, cross-pair state, malformed
durable state, and bounded ingress excess. It contains no AES implementation,
secret, authentication claim, or command-dispatch path.

Raw or merely parsed wire frames cannot produce an authenticated or dispatchable
receipt. The replay helper consumes separate candidate metadata and labels every
result `non-authoritative`, `not-proved-by-this-contract`, and
`dispatchAuthorized: false`, including a fresh counter result. The deferred
target crypto adapter remains the missing security boundary.

`src/encrypted-ir-security.test.ts` verifies the public NIST AES-256-GCM
known-answer vector with nonempty AAD and plaintext through the platform crypto
library, including mutated-AAD, ciphertext, and tag rejection, plus adversarial
replay, state-binding, durable-ledger, queue, and rate cases. The target ESP-IDF
adapter must run the same vector and prove its unforgeable authentication-to-
replay boundary before the independent review can remove the DENY.

## Primary sources

- [NIST SP 800-38D](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf), especially the GCM IV uniqueness requirement and deterministic IV construction.
- [NIST GCM AES-256 Example 4](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/AES_GCM.pdf), the nonempty 512-bit AAD/plaintext known-answer vector used by the executable test.
- [NIST SP 800-57 Part 1](https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-57pt1r5.pdf), for key lifecycle, compromise, revocation, and audit principles.
- [RFC 8949](https://www.rfc-editor.org/rfc/rfc8949.html), Section 4.2 deterministic CBOR requirements.
- [ESP-IDF Mbed TLS for ESP32-S3](https://docs.espressif.com/projects/esp-idf/en/latest/esp32s3/api-reference/protocols/mbedtls.html), which documents GCM support and ESP32 cryptographic acceleration.
- [ESP-IDF ESP32-S3 security overview](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/security/security.html), for Secure Boot and flash-encryption production guidance.
