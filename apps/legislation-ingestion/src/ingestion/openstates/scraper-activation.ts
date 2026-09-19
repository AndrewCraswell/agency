export const approvedScraperBuildInputsSha256 = "e8d0ffa3bb0427ce079632f45dcb875baf7d602bae3c972e6d76de57030c1213"
// Isolated acceptance candidate. Regular syncing remains gated separately.
export const washingtonScraperCandidateBuild = "7b5f40cb0eca33867b3509486a7f8f869733ec033d79f2a19f47c7189dd17b01"
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
