import { readBounded, RetryingHttpClient } from "../http-client.js"

const MAXIMUM_DIRECTORY_BYTES = 5 * 1024 * 1024
const MAXIMUM_BILL_STATUS_BYTES = 25 * 1024 * 1024

export interface GovInfoBillStatusPackage {
  billType: string
  congress: number
  packageId: string
  url: URL
}

export class GovInfoClient {
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
      }
    }
    return packages.sort((left, right) => left.packageId.localeCompare(right.packageId))
  }

  async getBillStatus(source: GovInfoBillStatusPackage): Promise<string> {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      await this.#http.getBytes(source.url, MAXIMUM_BILL_STATUS_BYTES, {
        headers: { accept: "application/xml, text/xml" }
      })
    )
  }
}
