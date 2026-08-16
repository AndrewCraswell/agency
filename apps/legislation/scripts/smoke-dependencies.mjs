import { randomUUID } from "node:crypto"
import { DefaultAzureCredential } from "@azure/identity"
import { BlobServiceClient } from "@azure/storage-blob"
import pg from "pg"

const databaseUrl = process.env.DATABASE_URL
const storageAccount = process.env.AZURE_STORAGE_ACCOUNT
const containerName = process.env.AZURE_REPORT_CONTAINER ?? "reports"
if (databaseUrl === undefined || storageAccount === undefined) {
  throw new Error("DATABASE_URL and AZURE_STORAGE_ACCOUNT are required")
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 })
const service = new BlobServiceClient(`https://${storageAccount}.blob.core.windows.net`, new DefaultAzureCredential())
const blob = service.getContainerClient(containerName).getBlockBlobClient(`deployment-proof/${randomUUID()}.txt`)
try {
  const database = await pool.query("select extversion from pg_extension where extname = 'vector'")
  if (database.rows[0]?.extversion === undefined) {
    throw new Error("pgvector is not installed")
  }
  await blob.upload("legislation deployment proof", Buffer.byteLength("legislation deployment proof"), {
    conditions: { ifNoneMatch: "*" }
  })
  const downloaded = await blob.downloadToBuffer()
  if (downloaded.toString("utf8") !== "legislation deployment proof") {
    throw new Error("Blob round trip returned unexpected content")
  }
  process.stdout.write(`${JSON.stringify({ blob: "round-trip", pgvector: database.rows[0].extversion })}\n`)
} finally {
  await Promise.allSettled([blob.deleteIfExists(), pool.end()])
}
