import { z } from "zod"
import { RetryingHttpClient } from "../http-client.js"

const paginationSchema = z
  .object({ count: z.number().int().nonnegative().optional(), next: z.string().optional() })
  .default({})
const billReferenceSchema = z.object({
  congress: z.number().int().positive(),
  number: z.string().min(1),
  type: z.string().min(1),
  updateDate: z.string().optional(),
  url: z.string().min(1)
})
const billListSchema = z.object({ bills: z.array(billReferenceSchema).default([]), pagination: paginationSchema })
const amendmentReferenceSchema = z.object({
  congress: z.number().int().positive(),
  number: z.string().min(1),
  type: z.string().min(1),
  updateDate: z.string().optional(),
  url: z.string().min(1)
})

export type CongressBillReference = {
  congress: number
  number: string
  type: string
  updateDate?: string
  url: string
}

export type CongressAmendmentReference = z.infer<typeof amendmentReferenceSchema>

export interface CongressClientOptions {
  apiKey: string
  baseUrl: URL
  http: RetryingHttpClient
  onPage?: (progress: Readonly<{ next: boolean; offset: number; records: number }>) => void
  pageSize?: number
}

export class CongressClient {
  readonly #apiKey: string
  readonly #baseUrl: URL
  readonly #http: RetryingHttpClient
  readonly #onPage?: CongressClientOptions["onPage"]
  readonly #pageSize: number

  constructor(options: CongressClientOptions) {
    this.#apiKey = options.apiKey
    this.#baseUrl = options.baseUrl
    this.#http = options.http
    this.#onPage = options.onPage
    this.#pageSize = Math.min(options.pageSize ?? 250, 250)
  }

  async *listUpdated(fromDateTime: Date, toDateTime: Date): AsyncGenerator<CongressBillReference> {
    let offset = 0
    for (;;) {
      const response = billListSchema.parse(
        await this.#json("bill", {
          fromDateTime: congressDateTime(fromDateTime),
          limit: String(this.#pageSize),
          offset: String(offset),
          sort: "updateDate+asc",
          toDateTime: congressDateTime(toDateTime)
        })
      )
      this.#onPage?.({ next: response.pagination.next !== undefined, offset, records: response.bills.length })
      for (const bill of response.bills) {
        yield bill
      }
      if (response.pagination.next === undefined || response.bills.length === 0) {
        return
      }
      offset += response.bills.length
    }
  }

  async *members(congress: number): AsyncGenerator<readonly unknown[]> {
    yield* this.#pages(`member/congress/${congress}`, "members")
  }

  async *committees(congress: number): AsyncGenerator<readonly unknown[]> {
    yield* this.#pages(`committee/${congress}`, "committees")
  }

  async *amendments(
    congress: number,
    startOffset = 0
  ): AsyncGenerator<{ offset: number; reference: CongressAmendmentReference }> {
    let offset = startOffset
    for (;;) {
      const response = z
        .object({ amendments: z.array(amendmentReferenceSchema).default([]), pagination: paginationSchema })
        .parse(await this.#json(`amendment/${congress}`, { limit: String(this.#pageSize), offset: String(offset) }))
      this.#onPage?.({ next: response.pagination.next !== undefined, offset, records: response.amendments.length })
      for (const [index, reference] of response.amendments.entries()) {
        yield { offset: offset + index, reference }
      }
      if (response.pagination.next === undefined || response.amendments.length === 0) {
        return
      }
      offset += response.amendments.length
    }
  }

  async getAmendmentBundle(reference: CongressAmendmentReference): Promise<unknown> {
    const path = `amendment/${reference.congress}/${reference.type.toLowerCase()}/${reference.number}`
    const [detail, actions, textVersions] = await Promise.all([
      this.#json(path),
      this.#collection(`${path}/actions`, "actions"),
      this.#collection(`${path}/text`, "textVersions")
    ])
    const amendment = z.object({ amendment: z.record(z.string(), z.unknown()) }).parse(detail).amendment
    return { actions, amendment, sourceUrl: reference.url, textVersions }
  }

  async getBillBundle(reference: CongressBillReference): Promise<unknown> {
    const path = `bill/${reference.congress}/${reference.type.toLowerCase()}/${reference.number}`
    const [bill, actions, committees, cosponsors, relatedBills, subjects, summaries, textVersions] = await Promise.all([
      this.#json(path),
      this.#collection(`${path}/actions`, "actions"),
      this.#collection(`${path}/committees`, "committees"),
      this.#collection(`${path}/cosponsors`, "members"),
      this.#collection(`${path}/relatedbills`, "relatedBills"),
      this.#collection(`${path}/subjects`, "subjects"),
      this.#collection(`${path}/summaries`, "summaries"),
      this.#collection(`${path}/text`, "textVersions")
    ])
    const billObject = z.object({ bill: z.record(z.string(), z.unknown()) }).parse(bill).bill
    return {
      actions,
      bill: billObject,
      committees,
      cosponsors,
      relatedBills,
      subjects: subjects.map((subject) =>
        typeof subject === "object" && subject !== null && "name" in subject ? subject.name : subject
      ),
      summaries,
      textVersions
    }
  }

  async #collection(path: string, key: string): Promise<unknown[]> {
    const records: unknown[] = []
    for await (const page of this.#pages(path, key)) {
      records.push(...page)
    }
    return records
  }

  async *#pages(path: string, key: string): AsyncGenerator<readonly unknown[]> {
    let offset = 0
    for (;;) {
      const response = z
        .record(z.string(), z.unknown())
        .parse(await this.#json(path, { limit: "250", offset: String(offset) }))
      const value = response[key]
      const page = Array.isArray(value) ? value : []
      yield page
      const pagination = paginationSchema.parse(response.pagination)
      if (pagination.next === undefined || page.length === 0) {
        return
      }
      offset += page.length
    }
  }

  async #json(path: string, parameters: Readonly<Record<string, string>> = {}): Promise<unknown> {
    const url = new URL(path.replace(/^\//, ""), `${this.#baseUrl.href.replace(/\/$/, "")}/`)
    url.searchParams.set("api_key", this.#apiKey)
    url.searchParams.set("format", "json")
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value)
    }
    const response = await this.#http.get(url)
    return response.json() as Promise<unknown>
  }
}

function congressDateTime(value: Date): string {
  return value.toISOString().replace(/\.\d{3}Z$/, "Z")
}
