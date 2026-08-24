/**
 * Canonical identity accepted at every remote-command boundary.
 *
 * These values are opaque, but restricting them to a bounded ASCII grammar
 * makes command, authority, persisted snapshot, and fixture identities
 * comparable without a lossy normalization step.
 */
const REMOTE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/u

/** Internal shared remote-identity predicate; this module is not package-exported. */
export function isRemoteIdentifier(value: unknown): value is string {
  return typeof value === "string" && REMOTE_IDENTIFIER.test(value)
}
