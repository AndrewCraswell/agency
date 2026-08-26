import { describe, expect, it, vi } from "vitest"
import {
  RepresentativeLookupProviderFailureError,
  RepresentativeLookupProviderUnavailableError,
  UnavailableAddressToDistrictProvider,
  type AddressToDistrictProvider,
  type DistrictResolution,
  type RepresentativeLookupRequest
} from "../../api/representative-lookup.js"
import type { AddressGeocoder, OpenStatesGeoClient } from "../../api/us-representative-lookup-provider.js"
import { RetryingHttpClient } from "../../ingestion/http-client.js"
import {
  createNextRepresentativeLookupProvider,
  type NextRepresentativeLookupConfig
} from "./representative-lookup-provider.js"

describe("Next representative lookup provider", () => {
  it("returns the typed unavailable provider only when the OpenStates credential is absent", async () => {
    const provider = createNextRepresentativeLookupProvider(config({ openStatesApiKey: undefined }))

    expect(provider).toBeInstanceOf(UnavailableAddressToDistrictProvider)
    await expect(provider.resolve(coordinates(), { signal: new AbortController().signal })).rejects.toBeInstanceOf(
      RepresentativeLookupProviderUnavailableError
    )
  })

  it("returns the typed unavailable provider when the canonical public API URL is absent", async () => {
    const provider = createNextRepresentativeLookupProvider(config({ publicApiBaseUrl: undefined }))

    expect(provider).toBeInstanceOf(UnavailableAddressToDistrictProvider)
    await expect(provider.resolve(coordinates(), { signal: new AbortController().signal })).rejects.toBeInstanceOf(
      RepresentativeLookupProviderUnavailableError
    )
  })

  it("uses the existing OpenStates configuration and bounded production retry policy", () => {
    const result = provider()
    const dependencies = dependenciesFor(result)
    const configured = createNextRepresentativeLookupProvider(config(), dependencies.dependencies)

    expect(configured).toBe(result)
    expect(dependencies.createRetryingHttpClient).toHaveBeenCalledWith({
      maxAttempts: 6,
      minimumIntervalMs: 750,
      requestTimeoutMs: 12_345
    })
    expect(dependencies.createOpenStatesClient).toHaveBeenCalledWith({
      apiKey: "openstates-test-key",
      baseUrl: new URL("https://openstates.example.test/v3"),
      http: dependencies.http
    })
    expect(dependencies.createCensusGeocoder).toHaveBeenCalledWith({ timeoutMs: 12_345 })
    expect(dependencies.createProvider).toHaveBeenCalledWith({
      apiBaseUrl: "https://api.example.test",
      geocoder: dependencies.geocoder,
      openStates: dependencies.openStates
    })
  })

  it("does not convert constructor failures to an unavailable provider", () => {
    const result = provider()
    const dependencies = dependenciesFor(result)
    dependencies.createOpenStatesClient.mockImplementation(() => {
      throw new Error("invalid provider base URL")
    })

    expect(() => createNextRepresentativeLookupProvider(config(), dependencies.dependencies)).toThrow(
      "invalid provider base URL"
    )
  })

  it("preserves typed provider failures and does not log address or coordinate input", async () => {
    const lookupFailure = new RepresentativeLookupProviderFailureError()
    const result = provider()
    const dependencies = dependenciesFor(result)
    result.resolve = async () => {
      throw lookupFailure
    }
    const log = vi.spyOn(console, "log")
    const warn = vi.spyOn(console, "warn")
    const error = vi.spyOn(console, "error")
    const configured = createNextRepresentativeLookupProvider(config(), dependencies.dependencies)

    await expect(
      configured.resolve(
        {
          address: {
            city: "Sacramento",
            country: "US",
            line1: "123 Secret Street",
            line2: null,
            postalCode: "95814",
            region: "CA"
          }
        },
        { signal: new AbortController().signal }
      )
    ).rejects.toBe(lookupFailure)
    expect(log).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()

    log.mockRestore()
    warn.mockRestore()
    error.mockRestore()
  })
})

function config(
  overrides: Readonly<{ openStatesApiKey?: string | undefined; publicApiBaseUrl?: string | undefined }> = {}
): NextRepresentativeLookupConfig {
  return {
    ingestion: {
      maxAttempts: 4,
      openStatesApiKey: "openStatesApiKey" in overrides ? overrides.openStatesApiKey : "openstates-test-key",
      openStatesApiUrl: "https://openstates.example.test/v3",
      requestTimeoutMs: 12_345
    },
    server: {
      publicApiBaseUrl: "publicApiBaseUrl" in overrides ? overrides.publicApiBaseUrl : "https://api.example.test"
    }
  }
}

function coordinates(): RepresentativeLookupRequest {
  return { coordinates: { latitude: 38.5816, longitude: -121.4944 } }
}

function provider(): AddressToDistrictProvider {
  return {
    resolve: async (): Promise<DistrictResolution> => ({
      districts: [],
      quality: "unresolved",
      representatives: [],
      warnings: []
    })
  }
}

function dependenciesFor(result: AddressToDistrictProvider) {
  const geocoder: AddressGeocoder = { geocode: async () => undefined }
  const http = new RetryingHttpClient({ maxAttempts: 1, requestTimeoutMs: 1_000 })
  const openStates: OpenStatesGeoClient = { peopleAtCoordinates: async () => [] }
  const createCensusGeocoder = vi.fn<(options: Readonly<{ timeoutMs: number }>) => AddressGeocoder>(() => geocoder)
  const createOpenStatesClient = vi.fn<
    (options: Readonly<{ apiKey: string; baseUrl: URL; http: RetryingHttpClient }>) => OpenStatesGeoClient
  >(() => openStates)
  const createProvider = vi.fn<
    (
      options: Readonly<{ apiBaseUrl: string; geocoder: AddressGeocoder; openStates: OpenStatesGeoClient }>
    ) => AddressToDistrictProvider
  >(() => result)
  const createRetryingHttpClient = vi.fn<
    (
      options: Readonly<{ maxAttempts: number; minimumIntervalMs: number; requestTimeoutMs: number }>
    ) => RetryingHttpClient
  >(() => http)

  return {
    createCensusGeocoder,
    createOpenStatesClient,
    createProvider,
    createRetryingHttpClient,
    dependencies: { createCensusGeocoder, createOpenStatesClient, createProvider, createRetryingHttpClient },
    geocoder,
    http,
    openStates
  }
}
