export const approvedScraperBuildInputsSha256 = "3da9712b50cc54d14a17d387cdc8a6bed8aab58f8445b1921cac227f73f0edd9"
export const legacyAlaskaEventBuildInputsSha256 = "8dd4689bcfe72cf8b1cee5372c1106bd9f077845bea3187074fe17cc833beaeb"

export function requireApprovedAlaskaEventReceiptBuild(value: string) {
  if (value !== approvedScraperBuildInputsSha256 && value !== legacyAlaskaEventBuildInputsSha256) {
    throw new Error("Alaska event receipt build is not approved")
  }
  return value
}

export function requireScraperActivation(jurisdiction: "ak" | "nc", value: string | undefined) {
  const states = new Set(
    (value ?? "")
      .split(",")
      .map((state) => state.trim().toLowerCase())
      .filter(Boolean)
  )
  if (!states.has(jurisdiction)) {
    throw new Error(`${jurisdiction === "ak" ? "Alaska" : "North Carolina"} self-hosted scraper is not activated`)
  }
}
