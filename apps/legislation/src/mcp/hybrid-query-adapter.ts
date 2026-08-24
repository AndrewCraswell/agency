import type { McpHttpMethod } from "./http-methods.js"
import { HttpLegislationQueryAdapter } from "./http-query-adapter.js"
import type { LegislationQueryApi } from "./tools.js"

type Input<Name extends keyof LegislationQueryApi> = Parameters<LegislationQueryApi[Name]>[0]

/**
 * Uses the public API only for methods an operator has explicitly enabled
 * after a remote parity check. The default empty allowlist makes hybrid mode
 * behavior-identical to the in-process transport.
 *
 * Remote errors are returned to callers unchanged. Falling back after an HTTP
 * request begins would hide API regressions and can repeat costly retrieval.
 */
export class HybridLegislationQueryAdapter implements LegislationQueryApi {
  readonly #http: HttpLegislationQueryAdapter
  readonly #httpMethods: ReadonlySet<McpHttpMethod>
  readonly #inProcess: LegislationQueryApi

  constructor(
    http: HttpLegislationQueryAdapter,
    inProcess: LegislationQueryApi,
    httpMethods: readonly McpHttpMethod[]
  ) {
    this.#http = http
    this.#httpMethods = new Set(httpMethods)
    this.#inProcess = inProcess
  }

  compareBillVersions(input: Input<"compareBillVersions">) {
    return this.#useHttp("compareBillVersions")
      ? this.#http.compareBillVersions(input)
      : this.#inProcess.compareBillVersions(input)
  }

  findRelatedBills(input: Input<"findRelatedBills">) {
    return this.#useHttp("findRelatedBills")
      ? this.#http.findRelatedBills(input)
      : this.#inProcess.findRelatedBills(input)
  }

  getAmendment(input: Input<"getAmendment">) {
    return this.#useHttp("getAmendment") ? this.#http.getAmendment(input) : this.#inProcess.getAmendment(input)
  }

  getBill(input: Input<"getBill">) {
    return this.#useHttp("getBill") ? this.#http.getBill(input) : this.#inProcess.getBill(input)
  }

  getBillVotes(input: Input<"getBillVotes">) {
    return this.#useHttp("getBillVotes") ? this.#http.getBillVotes(input) : this.#inProcess.getBillVotes(input)
  }

  getBillText(input: Input<"getBillText">) {
    return this.#useHttp("getBillText") ? this.#http.getBillText(input) : this.#inProcess.getBillText(input)
  }

  getBillTimeline(input: Input<"getBillTimeline">) {
    return this.#useHttp("getBillTimeline") ? this.#http.getBillTimeline(input) : this.#inProcess.getBillTimeline(input)
  }

  getCalendar(input: Input<"getCalendar">) {
    return this.#inProcess.getCalendar(input)
  }

  getEvent(input: Input<"getEvent">) {
    return this.#useHttp("getEvent") ? this.#http.getEvent(input) : this.#inProcess.getEvent(input)
  }

  getOrganization(input: Input<"getOrganization">) {
    return this.#useHttp("getOrganization") ? this.#http.getOrganization(input) : this.#inProcess.getOrganization(input)
  }

  getPerson(input: Input<"getPerson">) {
    return this.#useHttp("getPerson") ? this.#http.getPerson(input) : this.#inProcess.getPerson(input)
  }

  getSupportingMaterial(input: Input<"getSupportingMaterial">) {
    return this.#useHttp("getSupportingMaterial")
      ? this.#http.getSupportingMaterial(input)
      : this.#inProcess.getSupportingMaterial(input)
  }

  getVote(input: Input<"getVote">) {
    return this.#useHttp("getVote") ? this.#http.getVote(input) : this.#inProcess.getVote(input)
  }

  searchAmendments(input: Input<"searchAmendments">) {
    return this.#useHttp("searchAmendments")
      ? this.#http.searchAmendments(input)
      : this.#inProcess.searchAmendments(input)
  }

  searchBills(input: Input<"searchBills">) {
    return this.#useHttp("searchBills") ? this.#http.searchBills(input) : this.#inProcess.searchBills(input)
  }

  searchBillText(input: Input<"searchBillText">) {
    return this.#useHttp("searchBillText") ? this.#http.searchBillText(input) : this.#inProcess.searchBillText(input)
  }

  searchChanges(input: Input<"searchChanges">) {
    return this.#useHttp("searchChanges") ? this.#http.searchChanges(input) : this.#inProcess.searchChanges(input)
  }

  searchEvents(input: Input<"searchEvents">) {
    return !this.#useHttp("searchEvents") || hasAnyValue(input, ["classification", "sort", "status"])
      ? this.#inProcess.searchEvents(input)
      : this.#http.searchEvents(input)
  }

  searchOrganizations(input: Input<"searchOrganizations">) {
    return this.#useHttp("searchOrganizations")
      ? this.#http.searchOrganizations(input)
      : this.#inProcess.searchOrganizations(input)
  }

  searchPeople(input: Input<"searchPeople">) {
    return this.#useHttp("searchPeople") ? this.#http.searchPeople(input) : this.#inProcess.searchPeople(input)
  }

  searchSupportingMaterials(input: Input<"searchSupportingMaterials">) {
    return this.#useHttp("searchSupportingMaterials")
      ? this.#http.searchSupportingMaterials(input)
      : this.#inProcess.searchSupportingMaterials(input)
  }

  searchVotes(input: Input<"searchVotes">) {
    return !this.#useHttp("searchVotes") || hasAnyValue(input, ["from"])
      ? this.#inProcess.searchVotes(input)
      : this.#http.searchVotes(input)
  }

  #useHttp(method: McpHttpMethod): boolean {
    return this.#httpMethods.has(method)
  }
}

function hasAnyValue(input: object, names: readonly string[]): boolean {
  return names.some((name) => Reflect.get(input, name) !== undefined)
}
