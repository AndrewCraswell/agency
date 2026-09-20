import pg from "pg"
import { readQueryStatistics, type QueryStatisticsSort } from "../src/database/query-statistics"

const options = parseArguments(process.argv.slice(2))
const url =
  options.database === "canonical"
    ? (process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL)
    : (process.env.PASSAGE_SEARCH_DATABASE_PUBLIC_URL ??
      process.env.PASSAGE_SEARCH_DATABASE_URL ??
      process.env.DATABASE_PUBLIC_URL ??
      process.env.DATABASE_URL)
if (!url) {
  throw new Error(
    options.database === "canonical"
      ? "DATABASE_DIRECT_URL, DATABASE_PUBLIC_URL, or DATABASE_URL is required"
      : "PASSAGE_SEARCH_DATABASE_PUBLIC_URL, PASSAGE_SEARCH_DATABASE_URL, DATABASE_PUBLIC_URL, or DATABASE_URL is required"
  )
}

const pool = new pg.Pool({ connectionString: url, max: 1 })
try {
  const report = await readQueryStatistics(pool, options)
  console.log(JSON.stringify(report, null, 2))
} finally {
  await pool.end()
}

function parseArguments(arguments_: readonly string[]): Readonly<{
  database: "canonical" | "passage-search"
  limit: number
  sort: QueryStatisticsSort
}> {
  let database: "canonical" | "passage-search" = "canonical"
  let limit = 25
  let sort: QueryStatisticsSort = "total"
  for (const argument of arguments_) {
    if (argument.startsWith("--database=")) {
      const value = argument.slice("--database=".length)
      if (value !== "canonical" && value !== "passage-search") {
        throw new Error("--database must be canonical or passage-search")
      }
      database = value
    } else if (argument.startsWith("--limit=")) {
      limit = Number(argument.slice("--limit=".length))
    } else if (argument.startsWith("--sort=")) {
      const value = argument.slice("--sort=".length)
      if (value !== "calls" && value !== "mean" && value !== "total") {
        throw new Error("--sort must be calls, mean, or total")
      }
      sort = value
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  return { database, limit, sort }
}
