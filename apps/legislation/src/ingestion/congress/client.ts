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
const committeeMeetingReferenceSchema = z.object({
  chamber: z.string().min(1),
  congress: z.number().int().positive(),
  eventId: z.string().min(1),
  updateDate: z.string().optional(),
  url: z.string().min(1)
})
const hearingReferenceSchema = z.object({
  chamber: z.string().min(1),
  congress: z.number().int().positive(),
  jacketNumber: z.union([z.string(), z.number()]).transform(String),
  updateDate: z.string().optional(),
  url: z.string().min(1)
})
const houseVoteReferenceSchema = z
  .object({
    congress: z.number().int().positive(),
    identifier: z.union([z.string(), z.number()]).transform(String),
    legislationNumber: z.union([z.string(), z.number()]).transform(String).optional(),
    legislationType: z.string().min(1).optional(),
    rollCallNumber: z.number().int().positive(),
    sessionNumber: z.number().int().positive(),
    sourceDataURL: z.string().url(),
    updateDate: z.string().optional(),
    url: z.string().url()
  })
  .passthrough()
const committeeReportReferenceSchema = z
  .object({
    chamber: z.string().min(1),
    citation: z.string().min(1),
    cmte_rpt_id: z.union([z.string(), z.number()]).transform(String),
    congress: z.number().int().positive(),
    number: z.union([z.string(), z.number()]).transform(String),
    part: z.union([z.string(), z.number()]).transform(String).optional(),
    type: z.string().min(1),
    updateDate: z.string().optional(),
    url: z.string().url()
  })
  .passthrough()

export type CongressBillReference = {
  congress: number
  number: string
  type: string
  updateDate?: string
  url: string
}

export type CongressAmendmentReference = z.infer<typeof amendmentReferenceSchema>
export type CongressCommitteeMeetingReference = z.infer<typeof committeeMeetingReferenceSchema>
export type CongressHearingReference = z.infer<typeof hearingReferenceSchema>
export type CongressHouseVoteReference = z.infer<typeof houseVoteReferenceSchema>
export type CongressCommitteeReportReference = z.infer<typeof committeeReportReferenceSchema>

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
    const detail = await this.#json(path)
    const amendment = z.object({ amendment: z.record(z.string(), z.unknown()) }).parse(detail).amendment
    const collectionCount = (key: "actions" | "textVersions") =>
      z.object({ count: z.number().int().nonnegative() }).safeParse(amendment[key]).data?.count ?? 0
    const [actions, textVersions] = await Promise.all([
      collectionCount("actions") === 0 ? [] : this.#collection(`${path}/actions`, "actions"),
      collectionCount("textVersions") === 0 ? [] : this.#collection(`${path}/text`, "textVersions")
    ])
    return { actions, amendment, sourceUrl: reference.url, textVersions }
  }

  async *committeeMeetings(
    congress: number,
    startOffset = 0
  ): AsyncGenerator<{ offset: number; reference: CongressCommitteeMeetingReference }> {
    yield* this.#references(
      `committee-meeting/${congress}`,
      "committeeMeetings",
      committeeMeetingReferenceSchema,
      startOffset
    )
  }

  async getCommitteeMeeting(reference: CongressCommitteeMeetingReference): Promise<unknown> {
    const path = `committee-meeting/${reference.congress}/${reference.chamber.toLowerCase()}/${reference.eventId}`
    const detail = z.object({ committeeMeeting: z.record(z.string(), z.unknown()) }).parse(await this.#json(path))
    return { meeting: detail.committeeMeeting, sourceUrl: reference.url }
  }

  async *hearings(
    congress: number,
    startOffset = 0
  ): AsyncGenerator<{ offset: number; reference: CongressHearingReference }> {
    yield* this.#references(`hearing/${congress}`, "hearings", hearingReferenceSchema, startOffset)
  }

  async getHearing(reference: CongressHearingReference): Promise<unknown> {
    const path = `hearing/${reference.congress}/${reference.chamber.toLowerCase()}/${reference.jacketNumber}`
    const detail = z.object({ hearing: z.record(z.string(), z.unknown()) }).parse(await this.#json(path))
    return { hearing: detail.hearing, sourceUrl: reference.url }
  }

  async *committeeReports(
    congress: number,
    startOffset = 0
  ): AsyncGenerator<{ offset: number; reference: CongressCommitteeReportReference }> {
    yield* this.#references(`committee-report/${congress}`, "reports", committeeReportReferenceSchema, startOffset)
  }

  async getCommitteeReportBundle(reference: CongressCommitteeReportReference): Promise<unknown> {
    const path = `committee-report/${reference.congress}/${reference.type.toLowerCase()}/${reference.number}`
    const detail = z
      .object({ committeeReports: z.array(z.record(z.string(), z.unknown())).min(1) })
      .parse(await this.#json(path))
    const report =
      detail.committeeReports.find((candidate) => String(candidate.part ?? "") === String(reference.part ?? "")) ??
      detail.committeeReports[0]
    const textCount = z.object({ count: z.number().int().nonnegative() }).safeParse(report?.text).data?.count ?? 0
    const text = textCount === 0 ? [] : await this.#collection(`${path}/text`, "text")
    return { reference, report, text }
  }

  async *houseVotes(
    congress: number,
    session: number,
    startOffset = 0
  ): AsyncGenerator<{ offset: number; reference: CongressHouseVoteReference }> {
    yield* this.#references(
      `house-vote/${congress}/${session}`,
      "houseRollCallVotes",
      houseVoteReferenceSchema,
      startOffset
    )
  }

  async getHouseVoteBundle(reference: CongressHouseVoteReference): Promise<unknown> {
    const path = `house-vote/${reference.congress}/${reference.sessionNumber}/${reference.rollCallNumber}`
    const [detail, members] = await Promise.all([this.#json(path), this.#houseVoteMembers(`${path}/members`)])
    return {
      members,
      reference,
      vote: z.object({ houseRollCallVote: z.record(z.string(), z.unknown()) }).parse(detail).houseRollCallVote
    }
  }

  async #houseVoteMembers(path: string): Promise<Record<string, unknown>> {
    const results: unknown[] = []
    let metadata: Record<string, unknown> | undefined
    let expectedCount: number | undefined
    let offset = 0
    for (;;) {
      const response = z
        .object({
          houseRollCallVoteMemberVotes: z.unknown(),
          pagination: paginationSchema
        })
        .parse(await this.#json(path, { limit: "250", offset: String(offset) }))
      const page = Array.isArray(response.houseRollCallVoteMemberVotes)
        ? { results: response.houseRollCallVoteMemberVotes }
        : z.record(z.string(), z.unknown()).parse(response.houseRollCallVoteMemberVotes)
      const pageResults = z.array(z.unknown()).parse(page.results ?? [])
      metadata ??= page
      expectedCount ??= response.pagination.count
      results.push(...pageResults)
      if (response.pagination.next === undefined || pageResults.length === 0) {
        break
      }
      offset += pageResults.length
    }
    if (expectedCount !== undefined && results.length !== expectedCount) {
      throw new Error(
        `Congress.gov House vote member count mismatch: expected ${expectedCount}, received ${results.length}`
      )
    }
    return { ...metadata, results }
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
      bill: { ...billObject, url: billObject.url ?? reference.url },
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

  async *#references<T>(
    path: string,
    key: string,
    schema: z.ZodType<T>,
    startOffset: number
  ): AsyncGenerator<{ offset: number; reference: T }> {
    let offset = startOffset
    for (;;) {
      const response = z
        .record(z.string(), z.unknown())
        .parse(await this.#json(path, { limit: String(this.#pageSize), offset: String(offset) }))
      const records = z.array(schema).parse(response[key] ?? [])
      const pagination = paginationSchema.parse(response.pagination)
      this.#onPage?.({ next: pagination.next !== undefined, offset, records: records.length })
      for (const [index, reference] of records.entries()) {
        yield { offset: offset + index, reference }
      }
      if (pagination.next === undefined || records.length === 0) {
        return
      }
      offset += records.length
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
