# Product release manifest host contract

Status: bounded EVO-09 host-only software evidence. This contract does not select, download, flash, activate, or roll
back firmware and does not claim hardware or cryptographic verification evidence.

## Authorization boundary

The product release contains exactly one ESP32 artifact and one STM32 artifact. The decoder accepts at most 2,048
bytes and copies only bounded identifiers, revisions, lengths, security versions, and SHA-256 digest bytes into a
fixed-size result. It performs no allocation and accepts only canonical version 1 field order.

Authorization is a single decode, verify, and compatibility operation. It invokes an injected verifier callback over
the original signed byte prefix and the in-buffer signature; no public decoded manifest can be modified between those
steps. A missing signature or a verifier result other than `valid` fails before product, board, target, revision,
artifact, or downgrade compatibility is evaluated. This module does not implement cryptography and does not treat
parsing as signature verification.

Compatibility binds the release and both artifacts to one product ID, protocol revision, schema revision, and
configuration revision. Each processor also binds a board ID, target ID, exact artifact byte length, SHA-256 digest,
artifact security version, manifest security floor, installed security version, device security floor, target maximum
security version, and staging capacity. ESP32 security values are additionally bounded to its 16-bit secure-version
domain. A release cannot lower either processor's installed version or security floor.

## Canonical wire form

All integers are unsigned big-endian. The document starts with `SPRM`, version `1`, and top-level field count `13`.
Each field is `tag:u8`, `length:u16`, then value. Tags appear exactly as follows: release ID `1`, product ID `2`,
protocol revision `3`, schema revision `4`, configuration revision `5`, ESP32 security floor `6`, STM32 security
floor `7`, ESP32 artifact `8`, STM32 artifact `8`, algorithm `9`, signing domain `10`, key ID `11`, and signature `12`.
Version 1 pins algorithm `ed25519`, domain `scoring-product-release-v1`, a bounded nonempty key ID, and an exact 64-byte
signature. The signature covers every byte preceding its tag, including algorithm, domain, and key ID. The verifier
callback receives that original prefix and the original in-buffer signature.

An artifact value starts with field count `9`, followed by processor `1`, board ID `2`, target ID `3`, security version
`4`, artifact length `5`, SHA-256 digest `6`, protocol revision `7`, schema revision `8`, and configuration revision `9`.
Artifacts are canonically ordered ESP32 then STM32. IDs and revisions use nonempty ASCII letters, digits, hyphen,
underscore, or period. Unknown versions, tags, reordering, duplicates, omissions, trailing bytes, and out-of-bound
values fail closed.

Equal security versions are compatible at this authorization layer. Release-ID reuse, same-version replay policy,
installed release identity, selection, activation, and rollback state are intentionally deferred because this module
does not own persistent update state. The numeric check is therefore a security-version downgrade guard, not a full
anti-replay or rollback implementation.

Stable reason codes are returned for structural rejection, signature rejection, compatibility mismatch, artifact
length/digest mismatch, security-floor violation, and downgrade. They are software decisions only; update selection,
activation, flash integrity, network transport, key management, and recovery remain separate work.

Repository-wide verification and behavior-oracle wiring are intentionally deferred for root integration after this
isolated contract is approved. The bounded subtree provides standalone Debug, Release, and optional sanitizer CMake
host checks without changing shared scripts.
