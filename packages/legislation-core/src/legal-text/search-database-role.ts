const legalSearchDatabaseNames = new Set(["legislation_passage_search", "legislation_passage_search_destructive_test"])

export function isLegalSearchDatabaseName(value: unknown): value is string {
  return typeof value === "string" && legalSearchDatabaseNames.has(value)
}
