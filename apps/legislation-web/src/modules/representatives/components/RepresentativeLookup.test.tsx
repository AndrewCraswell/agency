// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { RepresentativeLookupResult } from "../contracts"
import { RepresentativeLookup } from "./RepresentativeLookup"

const matchedResult: RepresentativeLookupResult = {
  status: "matched",
  jurisdictions: [
    {
      code: "us",
      id: "jurisdiction:us",
      name: "United States",
      districts: [{ id: "district:wa:congress:1", name: "Washington 1", chamber: "congress" }]
    },
    {
      code: "wa",
      id: "jurisdiction:us-wa",
      name: "Washington",
      districts: [{ id: "district:wa:upper:45", name: "District 45", chamber: "upper" }]
    }
  ],
  representatives: [
    {
      name: "Suzan DelBene",
      party: "Democrat",
      office: "Representative",
      districtName: "Washington 1",
      jurisdictionCode: "us",
      imageUrl: "https://provider.example/suzan.jpg",
      officialUrl: "https://delbene.house.gov/",
      matchStatus: "matched",
      profile: {
        id: "person:us:delbene",
        name: "Suzan K. DelBene",
        party: "Democratic",
        imageUrl: "https://profiles.example/delbene.jpg",
        officialUrl: "https://delbene.house.gov/about/"
      }
    },
    {
      name: "Manka Dhingra",
      party: "Democratic",
      office: "State senator",
      districtName: "District 45",
      jurisdictionCode: "wa",
      imageUrl: null,
      officialUrl: null,
      matchStatus: "matched",
      profile: {
        id: "person:us-wa:dhingra",
        name: "Manka Dhingra",
        party: "Democratic",
        imageUrl: null,
        officialUrl: null
      }
    }
  ],
  warnings: ["Confirm district boundaries with an official election source."]
}

function createPosition(accuracy = 25): GeolocationPosition {
  const coordinates = {
    latitude: 47.67,
    longitude: -122.12,
    accuracy,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null
  }
  const timestamp = 1_789_801_200_000
  return {
    coords: { ...coordinates, toJSON: () => coordinates },
    timestamp,
    toJSON: () => ({ coords: coordinates, timestamp })
  }
}

function createLocationError(code: number): GeolocationPositionError {
  return {
    code,
    message: "Private provider location information",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3
  }
}

const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>()
const fetcher = vi.fn<typeof fetch>()
const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation")

function respondWith(result: RepresentativeLookupResult) {
  fetcher.mockResolvedValue(Response.json({ data: result, meta: { requestId: "lookup" }, links: {} }))
}

async function startLookup() {
  await userEvent.setup().click(screen.getByRole("button", { name: "Use my location" }))
  await act(async () => getCurrentPosition.mock.calls.at(-1)?.[0](createPosition()))
}

beforeEach(() => {
  const geolocation: Geolocation = {
    getCurrentPosition,
    watchPosition: vi.fn<Geolocation["watchPosition"]>(),
    clearWatch: vi.fn<Geolocation["clearWatch"]>()
  }
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: geolocation })
  vi.stubGlobal("fetch", fetcher)
  respondWith(matchedResult)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  if (originalGeolocation) {
    Object.defineProperty(navigator, "geolocation", originalGeolocation)
  } else {
    Reflect.deleteProperty(navigator, "geolocation")
  }
})

describe("RepresentativeLookup", () => {
  it("explains location use and waits for explicit keyboard consent", async () => {
    const user = userEvent.setup()
    render(<RepresentativeLookup />)
    const button = screen.getByRole("button", { name: "Use my location" })
    expect(screen.getByText(/Your browser sends coordinates to Geocodio/).textContent).toContain(
      "Rostra does not save your location."
    )
    expect(button.getAttribute("aria-describedby")).toBeTruthy()
    expect(getCurrentPosition).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
    await user.tab()
    expect(document.activeElement).toBe(button)
    await user.keyboard("{Enter}")
    expect(getCurrentPosition).toHaveBeenCalledExactlyOnceWith(expect.any(Function), expect.any(Function), {
      enableHighAccuracy: false,
      timeout: 10_000,
      maximumAge: 0
    })
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.getByRole("status").textContent).toContain("Waiting for your browser")
    expect(button.hasAttribute("disabled")).toBe(true)
  })

  it("posts coordinates and groups canonical matches using database jurisdiction names", async () => {
    const localStorageWrite = vi.spyOn(Storage.prototype, "setItem")
    const view = render(<RepresentativeLookup />)
    await startLookup()
    expect(fetcher).toHaveBeenCalledExactlyOnceWith("/api/dev/representatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: 47.67, longitude: -122.12 }),
      cache: "no-store",
      signal: expect.any(AbortSignal)
    })
    const results = screen.getByRole("region", { name: "Representative lookup results" })
    const federal = within(results).getByRole("region", { name: "United States" })
    const state = within(results).getByRole("region", { name: "Washington" })
    expect(within(federal).getByText("Suzan K. DelBene")).toBeDefined()
    expect(within(state).getByRole("article", { name: "Manka Dhingra" })).toBeDefined()
    expect(within(federal).getByText("Congressional district: Washington 1")).toBeDefined()
    expect(within(state).getByText("State upper chamber: District 45")).toBeDefined()
    expect(within(federal).getByText("Democrat")).toBeDefined()
    expect(within(federal).getByText("Democratic")).toBeDefined()
    expect(within(federal).getByText("Profile matched")).toBeDefined()
    expect(within(results).getByText(/Browser-reported accuracy: within about 25 meters/)).toBeDefined()
    expect(within(results).getByRole("region", { name: "Lookup warnings" })).toBeDefined()
    expect(results.hasAttribute("data-sentry-block")).toBe(true)
    expect(results.classList.contains("sentry-block")).toBe(true)
    expect(screen.getByRole("button", { name: "Use my location" }).hasAttribute("disabled")).toBe(false)
    expect(view.container.textContent).not.toContain("47.67")
    expect(view.container.textContent).not.toContain("-122.12")
    expect(localStorageWrite).not.toHaveBeenCalled()
    const portrait = within(federal).getByRole("img", { name: "Stored portrait of Suzan K. DelBene" })
    expect(portrait.getAttribute("referrerpolicy")).toBe("no-referrer")
    expect(portrait.getAttribute("src")).toBe("https://profiles.example/delbene.jpg")
    expect(portrait.getAttribute("width")).toBe("48")
    for (const link of within(results).getAllByRole("link")) {
      expect(link.getAttribute("rel")).toBe("noopener noreferrer")
      expect(link.getAttribute("target")).toBe("_blank")
      expect(link.getAttribute("href")).not.toContain("/records")
    }
    expect(
      within(federal)
        .getByRole("link", { name: /Official website from Rostra/ })
        .getAttribute("href")
    ).toBe("https://delbene.house.gov/about/")
    fireEvent.error(portrait)
    expect(within(federal).queryByRole("img")).toBeNull()
    expect(within(federal).getByText("Suzan K. DelBene")).toBeDefined()
  })

  it.each([
    { code: 1, message: "Location access was denied." },
    { code: 2, message: "Your location is unavailable." },
    { code: 3, message: "Finding your location took too long." }
  ])("shows a safe inline message for geolocation error $code and allows retry", async ({ code, message }) => {
    const user = userEvent.setup()
    render(<RepresentativeLookup />)
    await user.click(screen.getByRole("button", { name: "Use my location" }))
    act(() => getCurrentPosition.mock.calls[0]?.[1]?.(createLocationError(code)))
    expect(screen.getByRole("alert").textContent).toContain(message)
    expect(screen.queryByText(/Private provider location information/)).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Use my location" }))
    expect(getCurrentPosition).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("handles browsers without geolocation without making a request", async () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined })
    render(<RepresentativeLookup />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Use my location" }))
    expect(screen.getByRole("alert").textContent).toContain("This browser does not support location access.")
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("handles a synchronous browser location failure without leaking its details", async () => {
    getCurrentPosition.mockImplementationOnce(() => {
      throw new Error("Private browser location detail")
    })
    render(<RepresentativeLookup />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Use my location" }))
    expect(screen.getByRole("alert").textContent).toContain("Location access could not be started.")
    expect(screen.queryByText(/Private browser location detail/)).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("bounds location waiting even when the browser never calls back", async () => {
    vi.useFakeTimers()
    render(<RepresentativeLookup />)
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }))
    act(() => vi.advanceTimersByTime(10_000))
    expect(screen.getByRole("alert").textContent).toContain("Finding your location took too long.")
    await act(async () => getCurrentPosition.mock.calls[0]?.[0](createPosition()))
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Use my location" }).hasAttribute("disabled")).toBe(false)
  })

  it("disables duplicate submissions and displays the loading state", async () => {
    const pending = Promise.withResolvers<Response>()
    fetcher.mockReturnValue(pending.promise)
    render(<RepresentativeLookup />)
    await startLookup()
    await userEvent.setup().dblClick(screen.getByRole("button", { name: "Use my location" }))
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("status").textContent).toContain("Looking up representatives")
    expect(screen.getByLabelText("Loading representatives").getAttribute("aria-busy")).toBe("true")
    await act(async () => pending.resolve(Response.json({ data: matchedResult })))
    expect(screen.queryByLabelText("Loading representatives")).toBeNull()
  })

  it.each([
    { status: 503, message: "Representative lookup is unavailable." },
    { status: 429, message: "Too many lookup attempts." },
    { status: 500, message: "Representatives could not be loaded." }
  ])("handles HTTP $status without exposing raw error details", async ({ status, message }) => {
    fetcher.mockResolvedValue(Response.json({ error: { message: "Private coordinates 47.67" } }, { status }))
    render(<RepresentativeLookup />)
    await startLookup()
    expect(screen.getByRole("alert").textContent).toContain(message)
    expect(screen.queryByText(/Private coordinates/)).toBeNull()
    expect(screen.getByRole("button", { name: "Use my location" }).hasAttribute("disabled")).toBe(false)
  })

  it("handles a network rejection and can retry successfully", async () => {
    fetcher.mockRejectedValueOnce(new Error("Private request coordinates 47.67"))
    render(<RepresentativeLookup />)
    await startLookup()
    expect(screen.getByRole("alert").textContent).toContain("Check your connection and try again.")
    expect(screen.queryByText(/Private request coordinates/)).toBeNull()
    await startLookup()
    expect(screen.getByRole("heading", { name: "Representatives matched" })).toBeDefined()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it("rejects an invalid response schema rather than rendering untrusted fields", async () => {
    fetcher.mockResolvedValue(Response.json({ data: { status: "matched", address: "Private address" } }))
    render(<RepresentativeLookup />)
    await startLookup()
    expect(screen.getByRole("alert").textContent).toContain("Rostra received an unexpected response.")
    expect(screen.queryByRole("region", { name: "Representative lookup results" })).toBeNull()
    expect(screen.queryByText("Private address")).toBeNull()
  })

  it("handles malformed JSON without displaying its contents", async () => {
    fetcher.mockResolvedValue(new Response("Private location detail"))
    render(<RepresentativeLookup />)
    await startLookup()
    expect(screen.getByRole("alert").textContent).toContain("The lookup could not be completed.")
    expect(screen.queryByText("Private location detail")).toBeNull()
  })

  it.each([
    { status: "no_match", title: "No matching location found" },
    { status: "ambiguous", title: "The lookup needs confirmation" },
    { status: "unsupported", title: "This location is not supported" }
  ] as const)("explains $status without inventing representatives", async ({ status, title }) => {
    respondWith({ status, jurisdictions: [], representatives: [], warnings: [] })
    render(<RepresentativeLookup />)
    await startLookup()
    expect(screen.getByRole("heading", { name: title })).toBeDefined()
    expect(screen.getByText("No representatives were returned for this location.")).toBeDefined()
    expect(screen.queryByRole("article")).toBeNull()
    expect(screen.queryByRole("region", { name: "Lookup warnings" })).toBeNull()
  })

  it("shows unavailable names with the returned code and distinguishes unmatched provider records", async () => {
    respondWith({
      status: "partial",
      jurisdictions: [{ code: "wa", id: null, name: null, districts: [] }],
      representatives: matchedResult.representatives.map((representative) => ({
        ...representative,
        matchStatus: "missing_identifier",
        profile: null,
        party: null
      })),
      warnings: []
    })
    render(<RepresentativeLookup />)
    await startLookup()
    expect(screen.getByRole("heading", { name: "Some matches are incomplete" })).toBeDefined()
    expect(screen.getAllByRole("heading", { name: "Jurisdiction name unavailable" })).toHaveLength(2)
    expect(screen.getByText("Jurisdiction code: wa")).toBeDefined()
    expect(screen.getByText("Jurisdiction code: us")).toBeDefined()
    expect(screen.getAllByText("Provider identifier unavailable")).toHaveLength(2)
    expect(screen.getAllByText("Party unavailable")).toHaveLength(2)
    expect(screen.getAllByText(/No confirmed Rostra profile is available/)).toHaveLength(2)
    expect(screen.queryByText("Suzan K. DelBene")).toBeNull()
    expect(screen.queryByRole("img")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Washington" })).toBeNull()
  })

  it.each([
    { matchStatus: "not_found", label: "Profile not found" },
    { matchStatus: "ambiguous", label: "Profile match is ambiguous" }
  ] as const)("labels a $matchStatus profile explicitly", async ({ matchStatus, label }) => {
    respondWith({
      ...matchedResult,
      status: "partial",
      representatives: matchedResult.representatives.map((representative) => ({
        ...representative,
        matchStatus,
        profile: null
      }))
    })
    render(<RepresentativeLookup />)
    await startLookup()
    expect(screen.getAllByText(label)).toHaveLength(2)
  })

  it("shows empty jurisdictions and omits invalid accuracy estimates", async () => {
    respondWith({ ...matchedResult, status: "no_match", representatives: [] })
    render(<RepresentativeLookup />)
    await userEvent.setup().click(screen.getByRole("button", { name: "Use my location" }))
    await act(async () => getCurrentPosition.mock.calls[0]?.[0](createPosition(Number.NaN)))
    expect(screen.getAllByText("No representatives were returned for this jurisdiction.")).toHaveLength(2)
    expect(screen.queryByText(/Browser-reported accuracy/)).toBeNull()
    expect(screen.getByText(/An imprecise location can select the wrong district/)).toBeDefined()
  })

  it("aborts a timed-out request and ignores its late result", async () => {
    vi.useFakeTimers()
    const pending = Promise.withResolvers<Response>()
    fetcher.mockReturnValue(pending.promise)
    render(<RepresentativeLookup />)
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }))
    await act(async () => getCurrentPosition.mock.calls[0]?.[0](createPosition()))
    const signal = fetcher.mock.calls[0]?.[1]?.signal
    expect(signal?.aborted).toBe(false)
    act(() => vi.advanceTimersByTime(20_000))
    expect(signal?.aborted).toBe(true)
    expect(screen.getByRole("alert").textContent).toBe("The representative lookup took too long. Try again.")
    await act(async () => pending.resolve(Response.json({ data: matchedResult })))
    expect(screen.queryByRole("region", { name: "Representative lookup results" })).toBeNull()
  })

  it("cancels location waiting and ignores callbacks from the superseded attempt", async () => {
    const user = userEvent.setup()
    render(<RepresentativeLookup />)
    await user.click(screen.getByRole("button", { name: "Use my location" }))
    const cancelled = getCurrentPosition.mock.calls[0]
    await user.click(screen.getByRole("button", { name: "Cancel lookup" }))
    expect(screen.getByRole("status").textContent).toContain("Lookup cancelled.")
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Use my location" }))
    await user.click(screen.getByRole("button", { name: "Use my location" }))
    await act(async () => {
      cancelled?.[0](createPosition())
      cancelled?.[1]?.(createLocationError(1))
    })
    expect(fetcher).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).toBeNull()
    await act(async () => getCurrentPosition.mock.calls[1]?.[0](createPosition()))
    expect(screen.getByRole("heading", { name: "Representatives matched" })).toBeDefined()
  })

  it("cancels an active request and keeps a newer result when the old request finishes", async () => {
    const pending = Promise.withResolvers<Response>()
    fetcher.mockReturnValueOnce(pending.promise)
    const user = userEvent.setup()
    render(<RepresentativeLookup />)
    await startLookup()
    const signal = fetcher.mock.calls[0]?.[1]?.signal
    await user.click(screen.getByRole("button", { name: "Cancel lookup" }))
    expect(signal?.aborted).toBe(true)
    await startLookup()
    await act(async () =>
      pending.resolve(
        Response.json({
          data: { status: "unsupported", jurisdictions: [], representatives: [], warnings: [] }
        })
      )
    )
    expect(screen.getByRole("heading", { name: "Representatives matched" })).toBeDefined()
    expect(screen.queryByRole("heading", { name: "This location is not supported" })).toBeNull()
  })

  it("ignores a location callback after unmount", async () => {
    vi.useFakeTimers()
    const view = render(<RepresentativeLookup />)
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }))
    view.unmount()
    await act(async () => {
      getCurrentPosition.mock.calls[0]?.[0](createPosition())
      getCurrentPosition.mock.calls[0]?.[1]?.(createLocationError(1))
    })
    expect(fetcher).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("aborts the request and clears the timeout on unmount", async () => {
    vi.useFakeTimers()
    const pending = Promise.withResolvers<Response>()
    fetcher.mockReturnValue(pending.promise)
    const view = render(<RepresentativeLookup />)
    fireEvent.click(screen.getByRole("button", { name: "Use my location" }))
    await act(async () => getCurrentPosition.mock.calls[0]?.[0](createPosition()))
    const signal = fetcher.mock.calls[0]?.[1]?.signal
    view.unmount()
    expect(signal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    await act(async () => pending.resolve(Response.json({ data: matchedResult })))
    expect(screen.queryByRole("region", { name: "Representative lookup results" })).toBeNull()
  })
})
