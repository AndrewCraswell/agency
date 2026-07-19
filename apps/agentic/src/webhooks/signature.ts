import { createHmac, timingSafeEqual } from "node:crypto"

const signaturePattern = /^sha256=([0-9a-f]{64})$/u

export function verifyGitHubSignature(rawBody: Buffer, signatureHeader: string | undefined, secret: string): boolean {
  const match = signatureHeader === undefined ? null : signaturePattern.exec(signatureHeader)
  if (match === null || secret.length === 0) {
    return false
  }
  const provided = Buffer.from(match[1] ?? "", "hex")
  const expected = createHmac("sha256", secret).update(rawBody).digest()
  return provided.byteLength === expected.byteLength && timingSafeEqual(provided, expected)
}
