import { describe, expect, it, vi } from "vitest"
import { createGeocodioClient } from "./geocodio"

const federal = {
  type: "representative",
  bio: { first_name: "Alexandria", last_name: "Ocasio-Cortez", party: "Democrat" },
  references: { bioguide_id: "O000172" }
}
const state = {
  type: "representative",
  bio: { first_name: "Karines", last_name: "Reyes" },
  references: { openstates_id: "ocd-person/11111111-1111-1111-1111-111111111111" }
}
const district = (suffix: string, legislators: readonly unknown[] = [state]) => ({
  name: suffix,
  ocd_id: `ocd-division/country:us/state:ny/${suffix}`,
  current_legislators: legislators
})
const fields = {
  congressional_districts: [district("cd:14", [federal])],
  state_legislative_districts: { house: [district("sldl:87")], senate: [district("sldu:34")] }
}
const response = (results: readonly unknown[]) => ({ results: [{ response: { results } }] })

function setup(body: unknown = response([{ fields }]), status = 200) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }))
  return {
    fetcher,
    lookup: createGeocodioClient({ apiKey: "synthetic-secret", baseUrl: "https://api.geocod.io/v2/" }, fetcher)
  }
}

describe("Geocodio", () => {
  it("uses one non-cached POST and matches coordinates directly without putting them in a URL", async () => {
    const { fetcher, lookup } = setup()
    const result = await lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)
    const [url, init] = fetcher.mock.calls[0]!
    expect(String(url)).toBe(
      "https://api.geocod.io/v2/reverse?api_key=synthetic-secret&fields=cd%2Cstateleg&country=USA&limit=2&skipGeocoding=true"
    )
    expect(init).toMatchObject({
      method: "POST",
      body: '["40.8,-73.9"]',
      cache: "no-store",
      redirect: "error"
    })
    expect(result).toMatchObject({
      status: "matched",
      jurisdictions: [{ code: "US" }, { code: "NY" }],
      representatives: [
        { name: "Alexandria Ocasio-Cortez", identifier: { scheme: "bioguide", value: "O000172" } },
        { name: "Karines Reyes", identifier: { scheme: "openstates", value: state.references.openstates_id } },
        { name: "Karines Reyes", office: "State senator" }
      ]
    })
    expect(JSON.stringify(result)).not.toContain("40.8")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("supports an address in the POST body without retaining it", async () => {
    const { lookup, fetcher } = setup(response([{ fields, accuracy_type: "rooftop" }]))
    const result = await lookup({ address: "1109 N Highland St, Arlington VA" }, new AbortController().signal)
    const [url, init] = fetcher.mock.calls[0]!
    expect(String(url)).toContain("/geocode?")
    expect(String(url)).not.toContain("Highland")
    expect(init?.body).toBe('["1109 N Highland St, Arlington VA"]')
    expect(JSON.stringify(result)).not.toContain("Highland")
  })

  it.each([
    { results: [], status: "no_match" },
    { results: [{ fields }, { fields }], status: "ambiguous" },
    { results: [{ fields, accuracy_type: "place" }], status: "ambiguous" },
    { results: [{ fields, address_components: { country: "CA" } }], status: "unsupported" },
    { results: [{ fields: {} }], status: "unsupported" }
  ])("reports $status without inventing representatives", async ({ results, status }) => {
    const { lookup } = setup(response(results))
    const result = await lookup({ address: "An input address" }, new AbortController().signal)
    expect(result.status).toBe(status)
    expect(result.representatives).toEqual([])
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("does not label missing legislator information as a vacancy", async () => {
    const { lookup } = setup(response([{ fields: { congressional_districts: [district("cd:14", [])] } }]))
    const result = await lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)
    expect(result.status).toBe("partial")
    expect(result.warnings.join(" ")).toContain("does not confirm a vacancy")
  })

  it("deduplicates unicameral districts instead of creating a fictitious lower chamber", async () => {
    const same = district("sldu:1")
    const { lookup } = setup(
      response([{ fields: { ...fields, state_legislative_districts: { house: [same], senate: [same] } } }])
    )
    const result = await lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)
    expect(result.jurisdictions[1]?.districts).toEqual([{ id: same.ocd_id, name: same.name, chamber: "unicameral" }])
    expect(result.representatives[1]?.office).toBe("State legislator")
  })

  it("rejects conflicting state matches", async () => {
    const { lookup } = setup(
      response([
        {
          fields: {
            ...fields,
            state_legislative_districts: {
              house: [{ ...district("sldl:87"), ocd_id: "ocd-division/country:us/state:nj/sldl:1" }]
            }
          }
        }
      ])
    )
    expect((await lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)).status).toBe("ambiguous")
  })

  it.each([401, 403, 429, 500])("does not retry or expose a %s provider error body", async (status) => {
    const { lookup, fetcher } = setup({ error: "synthetic-secret and address" }, status)
    const pending = lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)
    await expect(pending).rejects.toMatchObject({ category: "dependency_unavailable" })
    await expect(pending).rejects.not.toHaveProperty("cause")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("drops network error causes containing credentials and location", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("synthetic-secret 40.8,-73.9"))
    const lookup = createGeocodioClient({ apiKey: "synthetic-secret", baseUrl: "https://api.geocod.io/v2" }, fetcher)
    const pending = lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)
    await expect(pending).rejects.toThrow("Geocodio could not be reached.")
    await expect(pending).rejects.not.toHaveProperty("cause")
  })

  it("labels senators as statewide and retains missing identifiers instead of guessing", async () => {
    const senator = { ...federal, type: "senator", references: {} }
    const { lookup } = setup(
      response([{ fields: { ...fields, congressional_districts: [district("cd:14", [senator])] } }])
    )
    const result = await lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)
    expect(result.representatives[0]).toMatchObject({
      office: "U.S. senator",
      districtName: "Statewide",
      identifier: null
    })
  })

  it("preserves cancellation in the transport signal without retrying", async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      expect(init?.signal?.aborted).toBe(true)
      throw new DOMException("synthetic-secret", "AbortError")
    })
    const lookup = createGeocodioClient({ apiKey: "synthetic-secret", baseUrl: "https://api.geocod.io/v2" }, fetcher)
    controller.abort()
    await expect(lookup({ latitude: 40.8, longitude: -73.9 }, controller.signal)).rejects.toThrow(
      "Representative lookup was cancelled."
    )
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each([{}, response([{ fields: { congressional_districts: [{ name: "bad" }] } }])])(
    "rejects malformed responses",
    async (body) => {
      const { lookup } = setup(body)
      await expect(lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)).rejects.toThrow(
        "Geocodio returned an unexpected response."
      )
    }
  )

  it("bounds provider response bytes and rejects invalid JSON", async () => {
    for (const text of ["not json", "x".repeat(1_048_577)]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(text))
      const lookup = createGeocodioClient({ apiKey: "synthetic-secret", baseUrl: "https://api.geocod.io/v2" }, fetcher)
      await expect(lookup({ latitude: 40.8, longitude: -73.9 }, new AbortController().signal)).rejects.toMatchObject({
        category: "dependency_unavailable"
      })
    }
  })
})
