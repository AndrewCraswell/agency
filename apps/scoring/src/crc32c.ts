/**
 * Calculates the reflected Castagnoli CRC-32C for an already-encoded byte
 * sequence. This module is app-internal; protocol modules retain any public
 * exports that callers already use.
 */
export function calculateCrc32c(bytes: Uint8Array): number {
  let crc = 0xffff_ffff

  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0x82f6_3b78 : 0)
    }
  }

  return (crc ^ 0xffff_ffff) >>> 0
}
