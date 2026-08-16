import type { OpenStatesArchive } from "./discover.js"

export const supportedOpenStatesJurisdictions = [
  "al",
  "ak",
  "az",
  "ar",
  "ca",
  "co",
  "ct",
  "de",
  "fl",
  "ga",
  "hi",
  "id",
  "il",
  "in",
  "ia",
  "ks",
  "ky",
  "la",
  "me",
  "md",
  "ma",
  "mi",
  "mn",
  "ms",
  "mo",
  "mt",
  "ne",
  "nv",
  "nh",
  "nj",
  "nm",
  "ny",
  "nc",
  "nd",
  "oh",
  "ok",
  "or",
  "pa",
  "ri",
  "sc",
  "sd",
  "tn",
  "tx",
  "ut",
  "vt",
  "va",
  "wa",
  "wv",
  "wi",
  "wy",
  "dc",
  "pr"
] as const

function sessionStartYear(session: string): number | undefined {
  const match = /(?:^|\D)((?:19|20)\d{2})(?:\D|$)/.exec(session)
  return match?.[1] === undefined ? undefined : Number(match[1])
}

export function createOpenStatesCoverageManifest(archives: OpenStatesArchive[], sinceYear = 2017) {
  const supported = new Set<string>(supportedOpenStatesJurisdictions)
  const inPolicy = archives.filter((archive) => {
    const year = sessionStartYear(archive.session)
    return supported.has(archive.jurisdictionCode) && (year === undefined || year >= sinceYear)
  })
  const discoveredJurisdictions = new Set(inPolicy.map((archive) => archive.jurisdictionCode))
  return {
    archives: inPolicy.map((archive) => ({
      jurisdictionCode: archive.jurisdictionCode,
      session: archive.session,
      url: archive.url.href
    })),
    discoveredAt: new Date().toISOString(),
    excludedArchives: archives.length - inPolicy.length,
    missingJurisdictions: supportedOpenStatesJurisdictions.filter((code) => !discoveredJurisdictions.has(code)),
    sinceYear,
    source: "openstates",
    version: 1
  } as const
}
