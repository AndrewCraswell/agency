const CALIFORNIA_LEGINFO_HOST = "leginfo.legislature.ca.gov"
const BILL_ANALYSIS_PATH = "/faces/billAnalysisClient.xhtml"
const BILL_NAVIGATION_PATH = "/faces/billNavClient.xhtml"
const BILL_PDF_PATH = "/faces/billPdf.xhtml"

export type CaliforniaPubinfoDocumentKey = `analysis:${string}` | `bill:${string}` | `version:${string}`

export function californiaPubinfoDocumentKey(sourceUrl: string): CaliforniaPubinfoDocumentKey | undefined {
  let url: URL
  try {
    url = new URL(sourceUrl)
  } catch {
    return undefined
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.hostname.toLowerCase() !== CALIFORNIA_LEGINFO_HOST ||
    url.username.length > 0 ||
    url.password.length > 0 ||
    url.hash.length > 0
  ) {
    return undefined
  }
  const billId = url.searchParams.get("bill_id")
  if (billId === null || !/^[0-9]{9}[A-Z0-9]+$/.test(billId)) {
    return undefined
  }
  if (url.pathname === BILL_PDF_PATH) {
    const version = url.searchParams.get("version")
    return version !== null && /^[0-9]{5}[A-Z0-9]+$/.test(version) ? `version:${version}` : undefined
  }
  if (url.pathname === BILL_NAVIGATION_PATH) {
    return url.searchParams.size === 1 ? `bill:${billId}` : undefined
  }
  if (url.pathname === BILL_ANALYSIS_PATH) {
    const analysisId = url.searchParams.get("analysisId")
    return analysisId !== null && /^[0-9]+$/.test(analysisId) ? `analysis:${analysisId}` : undefined
  }
  return undefined
}

function pubinfoField(value: string | undefined): string | undefined {
  if (value === undefined || value === "NULL") {
    return undefined
  }
  return value.startsWith("`") && value.endsWith("`") ? value.slice(1, -1) : value
}

function pubinfoRows(value: string): string[][] {
  return value
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"))
}

/**
 * Builds the stable URL-key to LOB-filename index exposed by California's
 * official PUBINFO export. Bill navigation URLs resolve through BILL_TBL's
 * current version; version and analysis URLs resolve directly to their LOBs.
 */
export function californiaPubinfoLobIndex(input: {
  analysisTable?: string
  billTable: string
  versionTable: string
}): Map<CaliforniaPubinfoDocumentKey, string> {
  const versionLobs = new Map<string, string>()
  for (const fields of pubinfoRows(input.versionTable)) {
    const version = pubinfoField(fields[0])
    const lob = pubinfoField(fields[14])
    if (version !== undefined && lob !== undefined) {
      versionLobs.set(version, lob)
    }
  }

  const index = new Map<CaliforniaPubinfoDocumentKey, string>()
  for (const [version, lob] of versionLobs) {
    index.set(`version:${version}`, lob)
  }
  for (const fields of pubinfoRows(input.billTable)) {
    const bill = pubinfoField(fields[0])
    const currentVersion = pubinfoField(fields[10])
    const lob = currentVersion === undefined ? undefined : versionLobs.get(currentVersion)
    if (bill !== undefined && lob !== undefined) {
      index.set(`bill:${bill}`, lob)
    }
  }
  for (const fields of pubinfoRows(input.analysisTable ?? "")) {
    const analysis = pubinfoField(fields[0])
    const lob = pubinfoField(fields[10])
    if (analysis !== undefined && lob !== undefined) {
      index.set(`analysis:${analysis}`, lob)
    }
  }
  return index
}

const PUBINFO_TABLE_FILES = new Set(["BILL_ANALYSIS_TBL.dat", "BILL_TBL.dat", "BILL_VERSION_TBL.dat"])

function concatenateChunks(chunks: Uint8Array[], byteLength: number): Uint8Array {
  const value = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    value.set(chunk, offset)
    offset += chunk.byteLength
  }
  return value
}

export async function readCaliforniaPubinfoTables(
  source: AsyncIterable<Uint8Array>
): Promise<{ analysisTable?: string; billTable: string; versionTable: string }> {
  const tables = new Map<string, Uint8Array>()
  let archiveError: Error | undefined
  const unzip = new Unzip((file) => {
    if (!PUBINFO_TABLE_FILES.has(file.name)) {
      return
    }
    const chunks: Uint8Array[] = []
    let byteLength = 0
    file.ondata = (error, data, final) => {
      if (error !== null) {
        archiveError = error
        return
      }
      chunks.push(data)
      byteLength += data.byteLength
      if (final) {
        tables.set(file.name, concatenateChunks(chunks, byteLength))
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  for await (const chunk of source) {
    unzip.push(chunk)
    if (archiveError !== undefined) {
      throw archiveError
    }
  }
  unzip.push(new Uint8Array(), true)
  if (archiveError !== undefined) {
    throw archiveError
  }
  const billTable = tables.get("BILL_TBL.dat")
  const versionTable = tables.get("BILL_VERSION_TBL.dat")
  if (billTable === undefined || versionTable === undefined) {
    throw new Error("California PUBINFO archive is missing required bill tables")
  }
  const decoder = new TextDecoder()
  const analysisTable = tables.get("BILL_ANALYSIS_TBL.dat")
  return {
    ...(analysisTable === undefined ? {} : { analysisTable: decoder.decode(analysisTable) }),
    billTable: decoder.decode(billTable),
    versionTable: decoder.decode(versionTable)
  }
}

export async function visitCaliforniaPubinfoLobs(
  source: AsyncIterable<Uint8Array>,
  filenames: ReadonlySet<string>,
  visit: (filename: string, bytes: Uint8Array) => Promise<void>,
  concurrency = 4
): Promise<Set<string>> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 32) {
    throw new Error("California PUBINFO LOB concurrency must be between 1 and 32")
  }
  const visited = new Set<string>()
  const pending = new Set<Promise<void>>()
  const completed: Array<{ bytes: Uint8Array; filename: string }> = []
  let archiveError: Error | undefined
  const unzip = new Unzip((file) => {
    if (!filenames.has(file.name)) {
      return
    }
    const chunks: Uint8Array[] = []
    let byteLength = 0
    file.ondata = (error, data, final) => {
      if (error !== null) {
        archiveError = error
        return
      }
      chunks.push(data)
      byteLength += data.byteLength
      if (final) {
        completed.push({ bytes: concatenateChunks(chunks, byteLength), filename: file.name })
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  const drainCompleted = async () => {
    while (completed.length > 0) {
      while (completed.length > 0 && pending.size < concurrency) {
        const entry = completed.shift()
        if (entry === undefined) {
          break
        }
        visited.add(entry.filename)
        const operation = visit(entry.filename, entry.bytes).finally(() => pending.delete(operation))
        pending.add(operation)
      }
      if (pending.size >= concurrency) {
        await Promise.race(pending)
      }
    }
  }
  for await (const chunk of source) {
    unzip.push(chunk)
    if (archiveError !== undefined) {
      throw archiveError
    }
    await drainCompleted()
  }
  unzip.push(new Uint8Array(), true)
  if (archiveError !== undefined) {
    throw archiveError
  }
  await drainCompleted()
  await Promise.all(pending)
  return visited
}
import { Unzip, UnzipInflate } from "fflate"
