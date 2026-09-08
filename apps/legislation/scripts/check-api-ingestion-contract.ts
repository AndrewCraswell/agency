import { checkApiIngestionContract } from "../src/api/ingestion-contract.js"

const origin = process.env.LEGISLATION_PUBLIC_API_BASE_URL?.trim()
if (!origin) {
  throw new Error("LEGISLATION_PUBLIC_API_BASE_URL is required before deploying ingestion")
}
await checkApiIngestionContract(origin)
process.stdout.write("Deployed API accepts the importer membership contract.\n")
