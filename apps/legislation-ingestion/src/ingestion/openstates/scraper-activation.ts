export const approvedScraperBuildInputsSha256 = "8dd4689bcfe72cf8b1cee5372c1106bd9f077845bea3187074fe17cc833beaeb"

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
