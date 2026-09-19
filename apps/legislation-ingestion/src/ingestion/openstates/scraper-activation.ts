export const approvedScraperBuildInputsSha256 = "e8d0ffa3bb0427ce079632f45dcb875baf7d602bae3c972e6d76de57030c1213"
// Local acceptance candidate only. The separate activation switch remains off until hosted acceptance.
export const washingtonScraperCandidateBuild = "3556d11cfa4010e0e8909e14b551f054e2b84a3d7deb0a242d62101e5bc8156e"
export const legacyAlaskaEventBuildInputsSha256 = "8dd4689bcfe72cf8b1cee5372c1106bd9f077845bea3187074fe17cc833beaeb"

export function requireApprovedAlaskaEventReceiptBuild(value: string) {
  if (value !== approvedScraperBuildInputsSha256 && value !== legacyAlaskaEventBuildInputsSha256) {
    throw new Error("Alaska event receipt build is not approved")
  }
  return value
}

export function requireScraperActivation(jurisdiction: "ak" | "nc" | "wa", value: string | undefined) {
  const states = new Set(
    (value ?? "")
      .split(",")
      .map((state) => state.trim().toLowerCase())
      .filter(Boolean)
  )
  if (!states.has(jurisdiction)) {
    const names = { ak: "Alaska", nc: "North Carolina", wa: "Washington" }
    throw new Error(`${names[jurisdiction]} self-hosted scraper is not activated`)
  }
}
