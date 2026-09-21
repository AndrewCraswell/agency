import { XMLParser } from "fast-xml-parser"
import { z } from "zod"
import { RetryingHttpClient } from "../http-client.js"

const MAXIMUM_XML_BYTES = 2 * 1024 * 1024
const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  processEntities: false,
  isArray: (name) => name === "vote" || name === "senator"
})

const voteSummarySchema = z.object({
  vote_summary: z.object({
    congress: z.string().trim(),
    session: z.string().trim(),
    votes: z.object({
      vote: z.array(z.object({ vote_number: z.string().trim().regex(/^\d+$/u) }).passthrough()).default([])
    })
  })
})

const memberDirectorySchema = z.object({
  senators: z.object({
    senator: z
      .array(
        z
          .object({
            "@_lis_member_id": z.string().trim().min(1),
            bioguideId: z.string().trim().min(1)
          })
          .passthrough()
      )
      .default([])
  })
})

export type SenateVoteReference = Readonly<{
  congress: number
  session: number
  sourceUrl: string
  voteNumber: number
}>

export type SenateXmlSource<T> = Readonly<{
  bytes: Uint8Array
  sourceUrl: string
  value: T
}>

export interface SenateClientOptions {
  baseUrl: URL
  http: RetryingHttpClient
}

export class SenateClient {
  readonly #baseUrl: URL
  readonly #http: RetryingHttpClient
  #memberIdentifiers?: Promise<SenateXmlSource<ReadonlyMap<string, string>>>

  constructor(options: SenateClientOptions) {
    this.#baseUrl = ensureTrailingSlash(options.baseUrl)
    this.#http = options.http
  }

  async listVotes(congress: number, session: number): Promise<SenateXmlSource<readonly SenateVoteReference[]>> {
    assertCongressSession(congress, session)
    const sourceUrl = this.#url(`legislative/LIS/roll_call_lists/vote_menu_${congress}_${session}.xml`)
    const bytes = await this.#http.getBytes(new URL(sourceUrl), MAXIMUM_XML_BYTES)
    const document = parseXml(bytes)
    // senate.gov redirects an unpublished session to an HTML "file not found" page with status 200.
    if (!hasXmlRoot(document, "vote_summary")) {
      return { bytes, sourceUrl, value: [] }
    }
    const parsed = voteSummarySchema.parse(document)
    if (Number(parsed.vote_summary.congress) !== congress || Number(parsed.vote_summary.session) !== session) {
      throw new Error(`Senate vote menu identity mismatch for Congress ${congress}, session ${session}`)
    }
    const references = parsed.vote_summary.votes.vote
      .map(({ vote_number }) => Number(vote_number))
      .map((voteNumber) => ({
        congress,
        session,
        sourceUrl: this.#url(
          `legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${String(voteNumber).padStart(5, "0")}.xml`
        ),
        voteNumber
      }))
      .toSorted((left, right) => left.voteNumber - right.voteNumber)
    return { bytes, sourceUrl, value: references }
  }

  async getVote(reference: SenateVoteReference): Promise<SenateXmlSource<string>> {
    const bytes = await this.#http.getBytes(new URL(reference.sourceUrl), MAXIMUM_XML_BYTES)
    const value = new TextDecoder().decode(bytes)
    if (!hasXmlRoot(parser.parse(value), "roll_call_vote")) {
      throw new Error(`Senate vote ${reference.voteNumber} is not published at ${reference.sourceUrl}`)
    }
    return { bytes, sourceUrl: reference.sourceUrl, value }
  }

  async getMemberIdentifiers(): Promise<SenateXmlSource<ReadonlyMap<string, string>>> {
    this.#memberIdentifiers ??= this.#loadMemberIdentifiers()
    return this.#memberIdentifiers
  }

  async #loadMemberIdentifiers(): Promise<SenateXmlSource<ReadonlyMap<string, string>>> {
    const sourceUrl = this.#url("legislative/LIS_MEMBER/cvc_member_data.xml")
    const bytes = await this.#http.getBytes(new URL(sourceUrl), MAXIMUM_XML_BYTES)
    const parsed = memberDirectorySchema.parse(parseXml(bytes))
    return {
      bytes,
      sourceUrl,
      value: new Map(
        parsed.senators.senator.map((senator) => [senator["@_lis_member_id"], senator.bioguideId] as const)
      )
    }
  }

  #url(path: string): string {
    return new URL(path, this.#baseUrl).href
  }
}

function parseXml(bytes: Uint8Array): unknown {
  return parser.parse(new TextDecoder().decode(bytes))
}

function hasXmlRoot(document: unknown, root: string): boolean {
  return typeof document === "object" && document !== null && root in document
}

function ensureTrailingSlash(url: URL): URL {
  return new URL(url.href.endsWith("/") ? url.href : `${url.href}/`)
}

function assertCongressSession(congress: number, session: number): void {
  if (!Number.isSafeInteger(congress) || congress < 1 || (session !== 1 && session !== 2)) {
    throw new Error("Senate votes require a positive Congress and session 1 or 2")
  }
}
