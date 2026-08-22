import { unzipSync } from "fflate"
import { readBounded, RetryingHttpClient } from "../http-client.js"

const MAXIMUM_DIRECTORY_BYTES = 5 * 1024 * 1024
const MAXIMUM_BILL_STATUS_BYTES = 25 * 1024 * 1024
const MAXIMUM_ARCHIVE_BYTES = 256 * 1024 * 1024
const MAXIMUM_DECODED_ARCHIVE_BYTES = 512 * 1024 * 1024

export interface GovInfoBillStatusPackage {
  archiveEntry?: string
  archiveUrl?: URL
  billType: string
  congress: number
  packageId: string
  lastModified?: Date
  url: URL
}

export class GovInfoClient {
  #archiveLoad?: Readonly<{ entries: Promise<Record<string, Uint8Array>>; url: string }>
  #cachedArchive?: Readonly<{ entries: Record<string, Uint8Array>; url: string }>
  readonly #baseUrl: URL
  readonly #http: RetryingHttpClient

  constructor(http: RetryingHttpClient, baseUrl = new URL("https://www.govinfo.gov/bulkdata/BILLSTATUS/")) {
    this.#http = http
    this.#baseUrl = baseUrl
  }

  async discover(congresses: readonly number[], billTypes: readonly string[]): Promise<GovInfoBillStatusPackage[]> {
    const packages: GovInfoBillStatusPackage[] = []
    for (const congress of congresses) {
      for (const billType of billTypes) {
        const directory = new URL(`${congress}/${billType.toLowerCase()}/`, this.#baseUrl)
        const response = await this.#http.get(directory)
        const listing = new TextDecoder().decode(await readBounded(response, MAXIMUM_DIRECTORY_BYTES))
        const links = new Set<string>()
        for (const match of listing.matchAll(/href=["']([^"']*BILLSTATUS-[^"']+\.xml)["']/gi)) {
          if (match[1] !== undefined) {
            links.add(new URL(match[1], directory).href)
          }
        }
        for (const href of links) {
          const url = new URL(href)
          if (url.protocol !== "https:") {
            continue
          }
          const packageId = url.pathname
            .split("/")
            .at(-1)
            ?.replace(/\.xml$/i, "")
          if (packageId !== undefined) {
            packages.push({ billType: billType.toLowerCase(), congress, packageId, url })
          }
        }
        if (links.size === 0) {
          packages.push(...(await this.#discoverArchive(congress, billType, directory)))
        }
      }
    }
    return packages.sort((left, right) => {
      const archiveOrder = (left.archiveUrl?.href ?? left.url.href).localeCompare(
        right.archiveUrl?.href ?? right.url.href
      )
      return archiveOrder === 0 ? left.packageId.localeCompare(right.packageId) : archiveOrder
    })
  }

  async getBillStatus(source: GovInfoBillStatusPackage): Promise<string> {
    if (source.archiveEntry !== undefined && source.archiveUrl !== undefined) {
      if (this.#cachedArchive?.url !== source.archiveUrl.href) {
        if (this.#archiveLoad?.url !== source.archiveUrl.href) {
          this.#archiveLoad = {
            entries: this.#loadArchive(source.archiveUrl),
            url: source.archiveUrl.href
          }
        }
        const entries = await this.#archiveLoad.entries
        this.#cachedArchive = { entries, url: source.archiveUrl.href }
      }
      const entry = this.#cachedArchive.entries[source.archiveEntry]
      if (entry === undefined) {
        throw new Error(`GovInfo archive entry ${source.archiveEntry} is missing`)
      }
      if (entry.byteLength > MAXIMUM_BILL_STATUS_BYTES) {
        throw new Error(`GovInfo bill status exceeds the ${MAXIMUM_BILL_STATUS_BYTES} byte limit`)
      }
      return new TextDecoder("utf-8", { fatal: true }).decode(entry)
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(
      await this.#http.getBytes(source.url, MAXIMUM_BILL_STATUS_BYTES, {
        headers: { accept: "application/xml, text/xml" }
      })
    )
  }

  async #loadArchive(archiveUrl: URL): Promise<Record<string, Uint8Array>> {
    const content = await this.#http.getBytes(archiveUrl, MAXIMUM_ARCHIVE_BYTES)
    let decodedBytes = 0
    return unzipSync(content, {
      filter: (file) => {
        decodedBytes += file.originalSize
        if (decodedBytes > MAXIMUM_DECODED_ARCHIVE_BYTES) {
          throw new Error(`GovInfo archive expands beyond the ${MAXIMUM_DECODED_ARCHIVE_BYTES} byte limit`)
        }
        return file.name.toLowerCase().endsWith(".xml")
      }
    })
  }

  async #discoverArchive(congress: number, billType: string, directory: URL): Promise<GovInfoBillStatusPackage[]> {
    const normalizedType = billType.toLowerCase()
    const archiveUrl = new URL(`BILLSTATUS-${congress}-${normalizedType}.zip`, directory)
    const content = await this.#http.getBytes(archiveUrl, MAXIMUM_ARCHIVE_BYTES)
    const entries: string[] = []
    let decodedBytes = 0
    unzipSync(content, {
      filter: (file) => {
        decodedBytes += file.originalSize
        if (decodedBytes > MAXIMUM_DECODED_ARCHIVE_BYTES) {
          throw new Error(`GovInfo archive expands beyond the ${MAXIMUM_DECODED_ARCHIVE_BYTES} byte limit`)
        }
        if (file.name.toLowerCase().endsWith(".xml")) {
          entries.push(file.name)
        }
        return false
      }
    })
    return entries.map((archiveEntry) => {
      const packageId = archiveEntry.replace(/\.xml$/i, "")
      return {
        archiveEntry,
        archiveUrl,
        billType: normalizedType,
        congress,
        packageId,
        url: new URL(archiveEntry, directory)
      }
    })
  }
}
