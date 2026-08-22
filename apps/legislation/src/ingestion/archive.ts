import { gunzipSync, unzipSync } from "fflate"

const textDecoder = new TextDecoder("utf-8", { fatal: true })
// Current Open States session archives can exceed 256 MiB (New York is about
// 291 MB) without meaningfully expanding when decoded. Keep the download cap
// below the separate 512 MiB decoded-content guard.
export const MAXIMUM_ARCHIVE_BYTES = 384 * 1024 * 1024
export const MAXIMUM_DECODED_ARCHIVE_BYTES = 512 * 1024 * 1024

export function decodeArchiveRecords(
  content: Uint8Array,
  maximumDecodedBytes = MAXIMUM_DECODED_ARCHIVE_BYTES
): unknown[] {
  if (content[0] === 0x50 && content[1] === 0x4b) {
    let decodedBytes = 0
    const entries = unzipSync(content, {
      filter: (file) => {
        decodedBytes += file.originalSize
        if (decodedBytes > maximumDecodedBytes) {
          throw new Error(`Archive expands beyond the ${maximumDecodedBytes} byte limit`)
        }
        return file.name.endsWith(".json") || file.name.endsWith(".jsonl") || file.name.endsWith(".ndjson")
      }
    })
    return Object.entries(entries).flatMap(([name, bytes]) =>
      decodeJsonRecords(bytes, name.endsWith(".jsonl") || name.endsWith(".ndjson"))
    )
  }
  if (content[0] === 0x1f && content[1] === 0x8b) {
    const expectedBytes =
      content.length < 4
        ? 0
        : new DataView(content.buffer, content.byteOffset + content.byteLength - 4, 4).getUint32(0, true)
    if (expectedBytes > maximumDecodedBytes) {
      throw new Error(`Archive expands beyond the ${maximumDecodedBytes} byte limit`)
    }
    const decoded = gunzipSync(content)
    if (decoded.byteLength > maximumDecodedBytes) {
      throw new Error(`Archive expands beyond the ${maximumDecodedBytes} byte limit`)
    }
    return decodeJsonRecords(decoded, false)
  }
  if (content.byteLength > maximumDecodedBytes) {
    throw new Error(`Archive exceeds the ${maximumDecodedBytes} byte limit`)
  }
  return decodeJsonRecords(content, false)
}

function decodeJsonRecords(content: Uint8Array, lineDelimited: boolean): unknown[] {
  const text = textDecoder
    .decode(content)
    .replace(/^\uFEFF/, "")
    .trim()
  if (text.length === 0) {
    return []
  }
  if (lineDelimited) {
    return text
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as unknown)
  }
  const parsed: unknown = JSON.parse(text)
  if (Array.isArray(parsed)) {
    return parsed
  }
  if (typeof parsed === "object" && parsed !== null && "bills" in parsed && Array.isArray(parsed.bills)) {
    return parsed.bills
  }
  return [parsed]
}
