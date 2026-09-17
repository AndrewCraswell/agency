export const approvedScraperBuildInputsSha256 = "b9ba2dbe321b86084243119f0f36c83d304abca89e1061457453114629c60314"

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
