import { describe, expect, it, vi } from "vitest"
import {
  createDocumentHostLimiterForTest,
  cooldownForDocumentHost,
  minimumStartIntervalForDocumentHost,
  normalizedDocumentHost,
  slotsForDocumentHost,
  type DocumentHostLeaseRepository
} from "./host-limiter.js"

describe("durable document host limiter", () => {
  it("normalizes hosts and applies calibrated global slot caps", async () => {
    const repository = new RecordingLeaseRepository(1)
    const limiter = createDocumentHostLimiterForTest(repository, { defaultSlots: 2 })

    await limiter.withLease("https://LEGINFO.Legislature.CA.gov/faces/billPdf.xhtml?bill_id=1", async () => undefined)

    expect(normalizedDocumentHost("https://EXAMPLE.GOV/path")).toBe("example.gov")
    expect(
      normalizedDocumentHost("https://www.ilga.gov/legislation/fulltext.asp?DocName=SB1&DocTypeId=SB&GA=102")
    ).toBe("ilga.gov")
    expect(slotsForDocumentHost("leginfo.legislature.ca.gov", 8)).toBe(2)
    expect(slotsForDocumentHost("leg.colorado.gov", 2)).toBe(1)
    expect(slotsForDocumentHost("flsenate.gov", 2)).toBe(2)
    expect(slotsForDocumentHost("nebraskalegislature.gov", 2)).toBe(1)
    expect(slotsForDocumentHost("gc.nh.gov", 2)).toBe(1)
    expect(slotsForDocumentHost("www.gencourt.state.nh.us", 2)).toBe(1)
    expect(slotsForDocumentHost("www.legis.state.pa.us", 2)).toBe(2)
    expect(slotsForDocumentHost("www.palegis.us", 2)).toBe(2)
    expect(slotsForDocumentHost("search-prod.lis.state.oh.us", 2)).toBe(1)
    expect(slotsForDocumentHost("sdlegislature.gov", 2)).toBe(1)
    expect(slotsForDocumentHost("www.legislature.ohio.gov", 2)).toBe(1)
    expect(slotsForDocumentHost("www.revisor.mn.gov", 2)).toBe(1)
    expect(cooldownForDocumentHost("leg.colorado.gov")).toBe(1_000)
    expect(cooldownForDocumentHost("flsenate.gov")).toBe(1_500)
    expect(cooldownForDocumentHost("nebraskalegislature.gov")).toBe(5_000)
    expect(cooldownForDocumentHost("gc.nh.gov")).toBe(5_000)
    expect(cooldownForDocumentHost("www.gencourt.state.nh.us")).toBe(5_000)
    expect(cooldownForDocumentHost("legislation.nysenate.gov")).toBe(1_000)
    expect(cooldownForDocumentHost("www.legis.state.pa.us")).toBe(1_500)
    expect(cooldownForDocumentHost("www.palegis.us")).toBe(1_500)
    expect(minimumStartIntervalForDocumentHost("flsenate.gov")).toBe(1_500)
    expect(minimumStartIntervalForDocumentHost("congress.gov")).toBe(300)
    expect(minimumStartIntervalForDocumentHost("www.legis.state.pa.us")).toBe(1_500)
    expect(minimumStartIntervalForDocumentHost("www.palegis.us")).toBe(1_500)
    expect(minimumStartIntervalForDocumentHost("www.congress.gov")).toBe(300)
    expect(minimumStartIntervalForDocumentHost("example.gov")).toBe(0)
    expect(cooldownForDocumentHost("search-prod.lis.state.oh.us")).toBe(1_000)
    expect(cooldownForDocumentHost("sdlegislature.gov")).toBe(1_000)
    expect(cooldownForDocumentHost("www.legislature.ohio.gov")).toBe(5_000)
    expect(cooldownForDocumentHost("example.gov")).toBe(0)
    expect(slotsForDocumentHost("capitol.texas.gov", 2)).toBe(4)
    expect(slotsForDocumentHost("congress.gov", 2)).toBe(4)
    expect(slotsForDocumentHost("ilga.gov", 2)).toBe(4)
    expect(slotsForDocumentHost("legislation.nysenate.gov", 4)).toBe(2)
    expect(slotsForDocumentHost("www.nysenate.gov", 2)).toBe(4)
    expect(slotsForDocumentHost("www.govinfo.gov", 2)).toBe(4)
    expect(slotsForDocumentHost("www.congress.gov", 2)).toBe(4)
    expect(slotsForDocumentHost("example.gov", 2)).toBe(2)
    expect(
      normalizedDocumentHost(
        "http://www.legis.state.pa.us/CFDOCS/Legis/PN/Public/btCheck.cfm?txtType=DOC&sessYr=2021&sessInd=0&billBody=H&billTyp=B&billNbr=0128&pn=0095"
      )
    ).toBe("www.palegis.us")
    expect(
      normalizedDocumentHost(
        "http://www.legis.state.pa.us/CFDOCS/Legis/PN/Public/btCheck.cfm?txtType=PDF&sessYr=2021&sessInd=0&billBody=H&billTyp=B&billNbr=0128&pn=0095"
      )
    ).toBe("www.palegis.us")
    expect(repository.acquireInputs).toMatchObject([{ host: "leginfo.legislature.ca.gov", slots: 2 }])
    expect(repository.releaseInputs).toHaveLength(1)
  })

  it("releases a durable slot when the protected download fails", async () => {
    const repository = new RecordingLeaseRepository(1)
    const limiter = createDocumentHostLimiterForTest(repository)

    await expect(
      limiter.withLease("https://example.gov/document.pdf", async () => {
        throw new Error("publisher failed")
      })
    ).rejects.toThrow("publisher failed")

    expect(repository.releaseInputs).toHaveLength(1)
    expect(repository.releaseInputs[0]).toMatchObject({ host: "example.gov", slot: 1 })
  })

  it("pairs two latency-overlap slots with a host-wide request-start interval", async () => {
    const repository = new RecordingLeaseRepository(1)
    const limiter = createDocumentHostLimiterForTest(repository)

    await limiter.withLease("https://flsenate.gov/Session/Bill/2025/1/BillText/Filed/PDF", async () => undefined)

    expect(repository.acquireInputs).toEqual([
      expect.objectContaining({ host: "flsenate.gov", minimumStartIntervalMs: 1_500, slots: 2 })
    ])
  })

  it("bounds host-slot waiting and exposes the timeout to telemetry", async () => {
    const onEvent = vi.fn<(event: unknown) => void>()
    const limiter = createDocumentHostLimiterForTest(
      {
        acquire: async () => undefined,
        release: async () => undefined,
        renew: async () => true
      },
      { acquireTimeoutMs: 1, onEvent, pollIntervalMs: 1 }
    )

    await expect(limiter.withLease("https://example.gov/document.pdf", async () => undefined)).rejects.toThrow(
      "Document host limiter deferred"
    )
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ host: "example.gov", type: "timed-out" }))
  })

  it("renews a held slot and does not let release failure hide a completed download", async () => {
    vi.useFakeTimers()
    const renew = vi.fn<() => Promise<boolean>>(async () => true)
    const onEvent = vi.fn<(event: unknown) => void>()
    const limiter = createDocumentHostLimiterForTest(
      {
        acquire: async () => 1,
        release: async () => {
          throw new Error("database unavailable")
        },
        renew
      },
      { leaseDurationMs: 1_000, onEvent }
    )
    let complete: ((value: string) => void) | undefined
    const result = limiter.withLease(
      "https://example.gov/document.pdf",
      () => new Promise<string>((resolve) => (complete = resolve))
    )
    await vi.advanceTimersByTimeAsync(1_000)
    expect(renew).toHaveBeenCalledTimes(1)
    complete?.("downloaded")
    await expect(result).resolves.toBe("downloaded")
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "release-failed" }))
    vi.useRealTimers()
  })
})

class RecordingLeaseRepository implements DocumentHostLeaseRepository {
  readonly acquireInputs: Array<
    Readonly<{
      host: string
      leaseDurationMs: number
      minimumStartIntervalMs: number
      ownerId: string
      slots: number
    }>
  > = []
  readonly releaseInputs: Array<Readonly<{ cooldownMs: number; host: string; ownerId: string; slot: number }>> = []
  readonly renewInputs: Array<Readonly<{ host: string; leaseDurationMs: number; ownerId: string; slot: number }>> = []
  #remaining: number

  constructor(remaining: number) {
    this.#remaining = remaining
  }

  async acquire(
    input: Readonly<{
      host: string
      leaseDurationMs: number
      minimumStartIntervalMs: number
      ownerId: string
      slots: number
    }>
  ): Promise<number | undefined> {
    this.acquireInputs.push(input)
    if (this.#remaining === 0) {
      return undefined
    }
    this.#remaining -= 1
    return 1
  }

  async release(input: Readonly<{ cooldownMs: number; host: string; ownerId: string; slot: number }>): Promise<void> {
    this.releaseInputs.push(input)
  }

  async renew(
    input: Readonly<{ host: string; leaseDurationMs: number; ownerId: string; slot: number }>
  ): Promise<boolean> {
    this.renewInputs.push(input)
    return true
  }
}
