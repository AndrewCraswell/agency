import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { readFile, writeFile, mkdir, stat, link, rm } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify, isDeepStrictEqual } from "node:util"
import invariant from "tiny-invariant"
import { z } from "zod"
import { digest } from "./contracts.js"
import { inspectFrPdf, frPdfInspectionSchema } from "./fr-pdf-validation.js"
import { frSubjectKey } from "./fr-subject.js"

const execute = promisify(execFile)
const contract = "fr-reviewed-pdf-regions-2026-09-15"
const artifactHash = "2becceee78ccdac5369e37fa877be85a564ff01b103952082d545a748d97439a"
const artifactBytes = 5862981
const regionSchema = z
  .strictObject({
    page: z.int().positive(),
    left: z.number().nonnegative(),
    top: z.number().nonnegative(),
    right: z.number().positive(),
    bottom: z.number().positive()
  })
  .refine((r) => r.right > r.left && r.bottom > r.top, "invalid_pdf_region")
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const resultSchema = z.strictObject({
  contract: z.literal(contract),
  inspection: frPdfInspectionSchema,
  documents: z
    .array(
      z.strictObject({
        nativeIdentity: z.string(),
        publisherNumber: z.string(),
        regions: z.array(regionSchema).min(1).max(16),
        text: z.string().min(1),
        textHash: hash,
        requiredAnchors: z.array(z.string()),
        excludedAnchors: z.array(z.string()),
        footerCount: z.literal(1),
        status: z.literal("reviewed_region_text"),
        canonicalTextSource: z.literal("xml"),
        publicationReady: z.literal(false)
      })
    )
    .length(3),
  publicationReady: z.literal(false)
})

// Point coordinates on the original, unrotated 612 x 792 pages; ordered by column reading order.
// Every cut falls in a reviewed gutter or inter-document gap. Source XML remains canonical text.
const plans = [
  {
    nativeIdentity: "fr:2000-01-18:65:2537:rule",
    publisherNumber: "00-113",
    regions: [
      { page: 24, left: 40, top: 200, right: 216, bottom: 754 },
      { page: 24, left: 217, top: 55, right: 393, bottom: 754 },
      { page: 24, left: 394, top: 55, right: 572, bottom: 754 },
      { page: 25, left: 40, top: 55, right: 216, bottom: 735 }
    ],
    requiredAnchors: ["Revision of Class D Airspace; Hobbs, NM", "99-ASW-32", "JoEllen Csilio"],
    excludedAnchors: ["00-898", "Puerto Rico", "Seretha Lake"]
  },
  {
    nativeIdentity: "fr:2000-01-18:65:2639:notice",
    publisherNumber: "00-113",
    regions: [
      { page: 126, left: 40, top: 597, right: 216, bottom: 754 },
      { page: 126, left: 217, top: 55, right: 393, bottom: 754 },
      { page: 126, left: 394, top: 55, right: 572, bottom: 119 }
    ],
    requiredAnchors: ["ES-50581", "Seretha Lake", "Stephen G. Kopach"],
    excludedAnchors: ["00-111", "ES-50579", "Jefferson Lake", "Hobbs"]
  },
  {
    nativeIdentity: "00-1083",
    publisherNumber: "00-1083",
    regions: [
      { page: 97, left: 40, top: 181, right: 216, bottom: 754 },
      { page: 97, left: 217, top: 55, right: 393, bottom: 754 },
      { page: 97, left: 394, top: 55, right: 572, bottom: 754 },
      { page: 98, left: 40, top: 55, right: 216, bottom: 498 }
    ],
    requiredAnchors: ["FRL-6524-6", "EQSA-0100-133", "Norine E. Noonan"],
    excludedAnchors: ["00-1062", "00-1082", "Clean Air Act Advisory Committee"]
  }
]

/** Boundary validation can be used independently of PDF parsing, including adversarial bleed-through checks. */
export function validateReviewedFrRegionText(nativeIdentity: string, text: string) {
  const plan = plans.find((row) => row.nativeIdentity === nativeIdentity)
  invariant(plan, "fr_pdf_region_identity_unreviewed")
  const key = frSubjectKey(text)
  invariant(
    plan.requiredAnchors.every((anchor) => key.includes(frSubjectKey(anchor))),
    "fr_pdf_region_anchor_missing"
  )
  invariant(
    plan.excludedAnchors.every((anchor) => !key.includes(frSubjectKey(anchor))),
    "fr_pdf_region_adjacent_text"
  )
  const footers = [...key.matchAll(/\[fr doc\.\s+([a-z0-9]+(?:-[a-z0-9]+)+)\s+filed/g)]
  invariant(footers.length === 1 && footers[0]?.[1] === plan.publisherNumber, "fr_pdf_region_footer_mismatch")
  return {
    ...plan,
    text,
    textHash: digest(text),
    footerCount: 1 as const,
    status: "reviewed_region_text" as const,
    canonicalTextSource: "xml" as const,
    publicationReady: false as const
  }
}

/** Runs in a bounded child process; accepts only the pinned reviewed issue and region plans. */
export async function extractReviewedFrPdfRegions(path: string) {
  const inspection = await inspectFrPdf(path, "00-113")
  invariant(
    inspection.artifactHash === artifactHash && inspection.bytes === artifactBytes && inspection.pages === 321,
    "fr_pdf_regions_source_unreviewed"
  )
  const bytes = await readFile(path)
  invariant(bytes.length === artifactBytes && digest(bytes) === artifactHash, "fr_pdf_regions_source_changed")
  // inspectFrPdf has initialized the canvas globals required by the same PDF.js worker.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loading = getDocument({
    data: Uint8Array.from(bytes),
    stopAtErrors: true,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
    standardFontDataUrl: fileURLToPath(
      new URL("standard_fonts/", import.meta.resolve("pdfjs-dist/package.json"))
    ).replaceAll("\\", "/")
  })
  try {
    const pdf = await loading.promise
    const documents = []
    for (const plan of plans) {
      const texts = []
      for (const raw of plan.regions) {
        const region = regionSchema.parse(raw)
        const page = await pdf.getPage(region.page)
        const viewport = page.getViewport({ scale: 1 })
        invariant(
          page.rotate === 0 && viewport.width === 612 && viewport.height === 792,
          "fr_pdf_region_geometry_changed"
        )
        const content = await page.getTextContent()
        const selected = []
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) {
            continue
          }
          const [left, baseline] = viewport.convertToViewportPoint(item.transform[4] ?? NaN, item.transform[5] ?? NaN)
          invariant(
            left !== undefined && baseline !== undefined && Number.isFinite(left) && Number.isFinite(baseline),
            "fr_pdf_region_coordinates_invalid"
          )
          const top = baseline - item.height
          const right = left + item.width
          const intersects = right > region.left && left < region.right && baseline > region.top && top < region.bottom
          if (!intersects) {
            continue
          }
          invariant(
            left >= region.left && right <= region.right && top >= region.top && baseline <= region.bottom,
            "fr_pdf_region_cuts_text"
          )
          selected.push(item.str)
        }
        invariant(selected.length > 0, "fr_pdf_region_empty")
        texts.push(selected.join(" "))
        page.cleanup()
      }
      documents.push(validateReviewedFrRegionText(plan.nativeIdentity, texts.join("\n")))
    }
    return resultSchema.parse({ contract, inspection, documents, publicationReady: false })
  } finally {
    await loading.destroy()
  }
}

/** Content-addressed offline evidence. This does not publish or replace XML-derived document text. */
export async function stageReviewedFrPdfRegions(path: string, output: string) {
  const files = [
    import.meta.url,
    new URL("./fr-pdf-validation.ts", import.meta.url).href,
    new URL("./fr-subject.ts", import.meta.url).href,
    new URL("./workers/extract-fr-pdf-regions.ts", import.meta.url).href,
    import.meta.resolve("pdfjs-dist/package.json"),
    import.meta.resolve("@napi-rs/canvas/package.json")
  ]
  const implementationHash = digest(
    JSON.stringify(await Promise.all(files.map(async (file) => digest(await readFile(new URL(file))))))
  )
  const sourceStat = await stat(path)
  invariant(sourceStat.isFile() && sourceStat.size === artifactBytes, "fr_pdf_regions_source_unreviewed")
  const input = await readFile(path)
  invariant(input.length === artifactBytes && digest(input) === artifactHash, "fr_pdf_regions_source_unreviewed")
  const generation = digest(JSON.stringify([contract, artifactHash, implementationHash, plans]))
  const target = join(output, `${generation}.json`)
  const storedSchema = z.strictObject({ generation: hash, implementationHash: hash, result: resultSchema })
  const validate = (value: unknown) => {
    const stored = storedSchema.parse(value)
    invariant(
      stored.generation === generation &&
        stored.implementationHash === implementationHash &&
        stored.result.inspection.artifactHash === artifactHash &&
        stored.result.inspection.bytes === artifactBytes &&
        stored.result.inspection.pages === 321,
      "fr_pdf_regions_replay_mismatch"
    )
    invariant(
      new Set(stored.result.documents.map((row) => row.nativeIdentity)).size === plans.length,
      "fr_pdf_regions_inventory_mismatch"
    )
    for (const row of stored.result.documents) {
      invariant(
        isDeepStrictEqual(validateReviewedFrRegionText(row.nativeIdentity, row.text), row),
        "fr_pdf_regions_evidence_changed"
      )
    }
    return stored
  }
  const readStored = async () => {
    invariant((await stat(target)).size <= 8 * 1024 * 1024, "fr_pdf_regions_artifact_size_limit")
    return validate(JSON.parse(await readFile(target, "utf8")))
  }
  try {
    return { artifact: await readStored(), reused: true, path: target }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error
    }
  }
  const worker = fileURLToPath(new URL("./workers/extract-fr-pdf-regions.ts", import.meta.url))
  const result = await execute(process.execPath, ["--max-old-space-size=512", "--import", "tsx", worker, path], {
    timeout: 90000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
    env: Object.fromEntries(
      Object.entries(process.env).filter(([key]) =>
        ["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE"].includes(key.toUpperCase())
      )
    )
  })
  const artifact = validate({ generation, implementationHash, result: JSON.parse(result.stdout) })
  await mkdir(output, { recursive: true })
  const temporary = join(output, `${randomUUID()}.tmp`)
  let reused = false
  try {
    await writeFile(temporary, JSON.stringify(artifact), { flag: "wx", flush: true })
    try {
      await link(temporary, target)
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error
      }
      invariant(isDeepStrictEqual(await readStored(), artifact), "fr_pdf_regions_immutable_conflict")
      reused = true
    }
  } finally {
    await rm(temporary, { force: true })
  }
  return { artifact, reused, path: target }
}
