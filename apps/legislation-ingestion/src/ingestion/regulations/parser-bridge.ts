import { spawn } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { lstat, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { createInterface } from "node:readline"
import { fileURLToPath } from "node:url"
import { acquisitionUnitSchema, digest, type AcquisitionUnit } from "@repo/legislation-core/legal-text/contracts"
import {
  parserLimits,
  regulatoryParserContract,
  regulatoryParseSummarySchema,
  regulatoryRecordSchema
} from "@repo/legislation-core/legal-text/parser-contract"
import { z } from "zod"

const parserPath = fileURLToPath(new URL("../../../python/regulations/parse_xml.py", import.meta.url))

async function hashFile(path: string) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk)
  }
  return hash.digest("hex")
}

export function regulatoryParserCodeHash() {
  return hashFile(parserPath)
}

function parserEnvironment() {
  const environment: Record<string, string> = {}
  for (const name of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "LANG", "LC_ALL"]) {
    const value = process.env[name]
    if (value !== undefined) {
      environment[name] = value
    }
  }
  return environment
}

async function runParser(arguments_: string[], executable: string, timeoutMs: number) {
  await new Promise<void>((resolveRun, reject) => {
    const child = spawn(executable, ["-I", "-X", "utf8", parserPath, ...arguments_], {
      env: parserEnvironment(),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"]
    })
    let outputBytes = 0
    let stderr = ""
    let failure: Error | undefined
    const timer = setTimeout(() => {
      failure = new Error("Regulatory parser timed out")
      child.kill("SIGKILL")
    }, timeoutMs)
    const capture = (value: Buffer) => {
      outputBytes += value.byteLength
      if (outputBytes > 64 * 1024) {
        failure = new Error("Regulatory parser diagnostic output exceeded limit")
        child.kill("SIGKILL")
      }
    }
    // Do not forward subprocess output: it could contain source text or local paths.
    child.stdout.on("data", capture)
    child.stderr.on("data", (value: Buffer) => {
      capture(value)
      if (outputBytes <= 64 * 1024) {
        stderr += value.toString("utf8")
      }
    })
    child.once("error", () => {
      failure = new Error("Regulatory parser could not start")
    })
    child.once("close", (code) => {
      clearTimeout(timer)
      if (failure !== undefined || code !== 0) {
        let detail = `exit code ${code}`
        try {
          const diagnostic = z
            .strictObject({
              status: z.literal("failed"),
              errorCode: z.enum([
                "duplicate_identity",
                "node_size_limit",
                "record_size_limit",
                "output_size_limit",
                "missing_native_identity",
                "forbidden_xml_declaration",
                "xml_depth_limit",
                "wrong_title",
                "missing_document_number",
                "artifact_hash_mismatch",
                "malformed_xml",
                "parser_failed"
              ])
            })
            .safeParse(JSON.parse(stderr))
          if (diagnostic.success) {
            detail = diagnostic.data.errorCode
          }
        } catch {
          /* Ignore untrusted diagnostic text. */
        }
        reject(failure ?? new Error(`Regulatory parser failed: ${detail}`))
      } else {
        resolveRun()
      }
    })
  })
}

export async function validateRegulatoryOutput(
  directory: string,
  unit: AcquisitionUnit,
  artifactHash: string,
  codeHash: string,
  inspectRecord?: (record: z.infer<typeof regulatoryRecordSchema>) => void | Promise<void>
) {
  const summaryPath = join(directory, "summary.json")
  if ((await lstat(summaryPath)).size > 4 * 1024 * 1024) {
    throw new Error("Parser summary exceeds limit")
  }
  const summary = regulatoryParseSummarySchema.parse(JSON.parse(await readFile(summaryPath, "utf8")))
  if (
    summary.inputHash !== artifactHash ||
    summary.parserCodeHash !== codeHash ||
    summary.records !== summary.sourceRecords ||
    summary.records > parserLimits.maximumRecords
  ) {
    throw new Error("Parser input, contract or record count mismatch")
  }
  const identities = new Set<string>()
  const ordinals = new Set<number>()
  const hierarchy = new Map<string, { parentKey: string | null; ordinal: number; locator: string }>()
  const actualKinds: Record<string, number> = {}
  let totalBytes = 0
  let totalRecords = 0
  if (new Set(summary.shards.map((shard) => shard.file)).size !== summary.shards.length) {
    throw new Error("Duplicate parser shard")
  }
  for (const shard of summary.shards) {
    const path = join(directory, shard.file)
    const stat = await lstat(path)
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size !== shard.bytes ||
      stat.size > Math.max(16 * 1024 * 1024, parserLimits.maximumRecordBytes)
    ) {
      throw new Error("Parser shard byte count or file type mismatch")
    }
    totalBytes += stat.size
    if (totalBytes > parserLimits.maximumOutputBytes) {
      throw new Error("Parser output exceeds byte limit")
    }
    if ((await hashFile(path)) !== shard.sha256) {
      throw new Error("Parser shard checksum mismatch")
    }
    const stream = createReadStream(path, { encoding: "utf8" })
    const lines = createInterface({ input: stream, crlfDelay: Infinity })
    let count = 0
    try {
      for await (const line of lines) {
        if (Buffer.byteLength(line) + 1 > parserLimits.maximumRecordBytes) {
          throw new Error("Parser record exceeds byte limit")
        }
        const record = regulatoryRecordSchema.parse(JSON.parse(line))
        const provenance = record.provenance
        if (
          record.textHash !== digest(record.text) ||
          record.recordKey !== digest(`${unit.key}\n${record.sourceLocator}`) ||
          provenance.acquisitionUnitId !== unit.key ||
          provenance.artifactHash !== artifactHash ||
          provenance.sourceId !== unit.sourceId ||
          provenance.sourceUrl !== unit.sourceUrl ||
          provenance.edition !== unit.edition ||
          provenance.publisherIssueDate !== unit.issueDate ||
          provenance.currencyDate !== unit.currencyDate ||
          provenance.rightsProfileId !== unit.rightsProfileId ||
          provenance.jurisdictionKey !== "us"
        ) {
          throw new Error("Parser record provenance or content hash mismatch")
        }
        if (
          (unit.sourceId === "govinfo-fr") !== (record.recordType === "publication") ||
          (record.recordType === "publication") !== (record.publicationKind !== null)
        ) {
          throw new Error("Parser record kind does not match corpus")
        }
        if (hierarchy.has(record.recordKey) || identities.has(record.nativeId) || ordinals.has(record.ordinal)) {
          throw new Error("Duplicate parser record identity or ordinal")
        }
        if (record.blocks.some((block, index) => block.ordinal !== index)) {
          throw new Error("Parser block order mismatch")
        }
        hierarchy.set(record.recordKey, {
          parentKey: record.parentKey,
          ordinal: record.ordinal,
          locator: record.sourceLocator
        })
        identities.add(record.nativeId)
        ordinals.add(record.ordinal)
        if (inspectRecord !== undefined) {
          await inspectRecord(record)
        }
        actualKinds[record.nodeKind] = (actualKinds[record.nodeKind] ?? 0) + 1
        count++
      }
    } finally {
      lines.close()
      stream.destroy()
    }
    if (count !== shard.records) {
      throw new Error("Parser shard record count mismatch")
    }
    totalRecords += count
  }
  if (
    totalRecords !== summary.records ||
    Math.max(...Object.values(summary.countsByKind)) > totalRecords ||
    Object.keys(actualKinds).length !== Object.keys(summary.countsByKind).length ||
    Object.entries(actualKinds).some(([kind, count]) => summary.countsByKind[kind] !== count)
  ) {
    throw new Error("Parser output completeness mismatch")
  }
  for (const entry of hierarchy.values()) {
    if (entry.ordinal >= totalRecords) {
      throw new Error("Parser ordinal out of range")
    }
    if (entry.parentKey !== null) {
      const parent = hierarchy.get(entry.parentKey)
      if (parent === undefined || parent.ordinal >= entry.ordinal || !entry.locator.startsWith(`${parent.locator}/`)) {
        throw new Error("Parser parent missing or invalid")
      }
    }
  }
  return summary
}

export async function parseRegulatoryArtifact(input: {
  unit: AcquisitionUnit
  artifactHash: string
  path: string
  outputRoot: string
  pythonExecutable?: string
  timeoutMs?: number
}) {
  const unit = acquisitionUnitSchema.parse(input.unit)
  const artifactHash = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(input.artifactHash)
  const path = resolve(input.path)
  const sourceStat = await lstat(path)
  if (
    !sourceStat.isFile() ||
    sourceStat.isSymbolicLink() ||
    sourceStat.size > parserLimits.maximumInputBytes ||
    (await hashFile(path)) !== artifactHash
  ) {
    throw new Error("Parser source artifact size, type or checksum mismatch")
  }
  const codeHash = await regulatoryParserCodeHash()
  const generation = digest(JSON.stringify([regulatoryParserContract, codeHash, unit.key, artifactHash, parserLimits]))
  const root = resolve(input.outputRoot)
  await mkdir(root, { recursive: true })
  const directory = join(root, generation)
  try {
    await lstat(directory)
    return {
      directory,
      generation,
      reused: true,
      summary: await validateRegulatoryOutput(directory, unit, artifactHash, codeHash)
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error
    }
    // Only a missing generation starts new work; incomplete existing generations fail closed.
    try {
      await lstat(directory)
      throw new Error("Existing parser generation is incomplete")
    } catch (lookupError) {
      if (!(lookupError instanceof Error && "code" in lookupError && lookupError.code === "ENOENT")) {
        throw lookupError
      }
    }
  }
  const lockPath = join(root, `${generation}.lock`)
  const lock = await open(lockPath, "wx")
  const temporary = join(root, `${generation}-${randomUUID()}.staging`)
  try {
    await mkdir(temporary)
    await lock.writeFile(JSON.stringify({ pid: process.pid, unit: unit.key, generation }))
    const contextPath = join(temporary, "context.json")
    await writeFile(contextPath, JSON.stringify({ unit, artifactHash, limits: parserLimits }), { flag: "wx" })
    const staged = join(temporary, "output")
    await runParser(
      ["--input", path, "--context", contextPath, "--output", staged],
      input.pythonExecutable ?? "python",
      z
        .int()
        .positive()
        .max(900_000)
        .parse(input.timeoutMs ?? 300_000)
    )
    const summary = await validateRegulatoryOutput(staged, unit, artifactHash, codeHash)
    if (summary.inputBytes !== sourceStat.size) {
      throw new Error("Parser input byte count mismatch")
    }
    await rename(staged, directory)
    return { directory, generation, reused: false, summary }
  } finally {
    // Both paths are fixed children of the explicitly selected output root, created by this invocation.
    await rm(temporary, { recursive: true, force: true })
    await lock.close()
    await rm(lockPath)
  }
}
