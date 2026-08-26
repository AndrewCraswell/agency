import {
  UnavailableAddressToDistrictProvider,
  type AddressToDistrictProvider
} from "../../api/representative-lookup.js"
import {
  CensusAddressGeocoder,
  UsRepresentativeLookupProvider,
  type AddressGeocoder,
  type OpenStatesGeoClient
} from "../../api/us-representative-lookup-provider.js"
import type { LegislationConfig } from "../../config/config.js"
import { RetryingHttpClient } from "../../ingestion/http-client.js"
import { OpenStatesClient } from "../../ingestion/openstates/client.js"

export type NextRepresentativeLookupConfig = Readonly<{
  ingestion: Pick<
    LegislationConfig["ingestion"],
    "maxAttempts" | "openStatesApiKey" | "openStatesApiUrl" | "requestTimeoutMs"
  >
  server: Readonly<{ publicApiBaseUrl: string | undefined }>
}>

type RetryClientOptions = Readonly<{
  maxAttempts: number
  minimumIntervalMs: number
  requestTimeoutMs: number
}>

type OpenStatesClientOptions = Readonly<{
  apiKey: string
  baseUrl: URL
  http: RetryingHttpClient
}>

type CensusGeocoderOptions = Readonly<{ timeoutMs: number }>

type ProviderOptions = Readonly<{
  apiBaseUrl: string
  geocoder: AddressGeocoder
  openStates: OpenStatesGeoClient
}>

/**
 * Injecting these constructors makes the composition deterministic to test.
 * None of the factory functions receives lookup input, so address and
 * coordinate data cannot enter process-wide configuration or telemetry.
 */
export interface NextRepresentativeLookupProviderDependencies {
  createCensusGeocoder(options: CensusGeocoderOptions): AddressGeocoder
  createOpenStatesClient(options: OpenStatesClientOptions): OpenStatesGeoClient
  createProvider(options: ProviderOptions): AddressToDistrictProvider
  createRetryingHttpClient(options: RetryClientOptions): RetryingHttpClient
}

const defaultDependencies: NextRepresentativeLookupProviderDependencies = {
  createCensusGeocoder: (options) => new CensusAddressGeocoder(options),
  createOpenStatesClient: (options) => new OpenStatesClient(options),
  createProvider: (options) => new UsRepresentativeLookupProvider(options),
  createRetryingHttpClient: (options) => new RetryingHttpClient(options)
}

/**
 * Creates the US representative provider for the lazily composed Next route
 * handler. An unavailable provider is used only when its required OpenStates
 * credential or public API base URL is absent. All construction errors remain
 * visible so deployments do not mask provider misconfiguration as a 503.
 */
export function createNextRepresentativeLookupProvider(
  config: NextRepresentativeLookupConfig,
  dependencies: NextRepresentativeLookupProviderDependencies = defaultDependencies
): AddressToDistrictProvider {
  const { publicApiBaseUrl } = config.server
  const { openStatesApiKey } = config.ingestion
  if (openStatesApiKey === undefined || publicApiBaseUrl === undefined) {
    return new UnavailableAddressToDistrictProvider()
  }

  const http = dependencies.createRetryingHttpClient({
    maxAttempts: Math.max(config.ingestion.maxAttempts, 6),
    minimumIntervalMs: 750,
    requestTimeoutMs: config.ingestion.requestTimeoutMs
  })
  const openStates = dependencies.createOpenStatesClient({
    apiKey: openStatesApiKey,
    baseUrl: new URL(config.ingestion.openStatesApiUrl),
    http
  })
  const geocoder = dependencies.createCensusGeocoder({ timeoutMs: config.ingestion.requestTimeoutMs })

  return dependencies.createProvider({ apiBaseUrl: publicApiBaseUrl, geocoder, openStates })
}
