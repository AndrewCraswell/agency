import type { SQL } from "drizzle-orm"
import { PgDialect } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import {
  DOCUMENT_REMEDIATION_COHORTS,
  documentStatusForFailure,
  prepareDocumentRemediation,
  type DocumentRemediationCohort
} from "./jobs.js"

describe("document jobs", () => {
  it("keeps scheduled retries pending and reserves failed for exhausted transient attempts", () => {
    expect(documentStatusForFailure({ retryable: true }, 1, 4)).toBe("pending")
    expect(documentStatusForFailure({ retryable: true }, 3, 4)).toBe("pending")
    expect(documentStatusForFailure({ retryable: true }, 4, 4)).toBe("failed")
    expect(documentStatusForFailure({ retryable: false }, 1, 4)).toBe("unsupported")
  })

  it("exposes narrow document remediation cohorts", async () => {
    const expectedCohorts: DocumentRemediationCohort[] = [
      "colorado-legacy-acquia",
      "connecticut-ftp",
      "connecticut-tls",
      "district-of-columbia-lims-download",
      "illinois-beta-host",
      "image-ocr-missing-artifact",
      "image-ocr-stale-artifact",
      "mississippi-tls",
      "michigan-document-redirect",
      "michigan-tls",
      "minnesota-senate-resolutions",
      "nebraska-rate-limited",
      "new-hampshire-legacy-amendments",
      "ohio-legislature-tls",
      "oklahoma-legacy-archive",
      "pdf-flate-stream-ocr",
      "pennsylvania-fiscal-notes",
      "pennsylvania-legacy-bill-text",
      "rhode-island-legacy-bill-text",
      "texas-legacy-witness-list",
      "west-virginia-legacy-origin",
      "vermont-legacy-assets",
      "vermont-tls"
    ]
    expect(DOCUMENT_REMEDIATION_COHORTS).toEqual(expect.arrayContaining(expectedCohorts))

    const queries: SQL[] = []
    const database = {
      execute: async (query: SQL) => {
        queries.push(query)
        return { rows: [{ identifiers: [], prepared: 0 }] }
      }
    }
    for (const cohort of expectedCohorts) {
      await prepareDocumentRemediation(database as never, cohort, 25)
    }

    const dialect = new PgDialect()
    const statements = queries.map((query) => dialect.sqlToQuery(query).sql)
    const statementFor = (cohort: DocumentRemediationCohort) => statements[expectedCohorts.indexOf(cohort)]

    expect(statementFor("connecticut-ftp")).toContain("ftp://ftp.cga.ct.gov/(2017|2018)/tob/[hs]")
    expect(statementFor("colorado-legacy-acquia")).toContain(
      "^http://coga\\.prod\\.acquia-sites\\.com/sites/default/files/html-attachments/[^?#]+\\.pdf$"
    )
    expect(statementFor("connecticut-ftp")).toContain("processing_status = 'unsupported'")
    expect(statementFor("connecticut-tls")).toContain("https://www.cga.ct.gov/")
    expect(statementFor("district-of-columbia-lims-download")).toContain("^https?://lims.dccouncil.us/(Download/")
    expect(statementFor("district-of-columbia-lims-download")).toContain("Document download failed with HTTP 522")
    expect(statementFor("illinois-beta-host")).toContain("^https?://beta\\.ilga\\.gov/")
    expect(statementFor("image-ocr-missing-artifact")).toContain("blob_path is null")
    expect(statementFor("image-ocr-missing-artifact")).toContain("processing_error_category = 'ocr-required'")
    expect(statementFor("image-ocr-missing-artifact")).toContain("processing_status = 'unsupported'")
    expect(statementFor("image-ocr-stale-artifact")).toContain("blob_path is not null")
    expect(statementFor("image-ocr-stale-artifact")).toContain("processing_attempts = 8")
    expect(statementFor("image-ocr-stale-artifact")).toContain("coalesce(processing_error, '') = ''")
    expect(statementFor("image-ocr-stale-artifact")).toContain("blob_path = null")
    expect(statementFor("mississippi-tls")).toContain("http://billstatus.ls.state.ms.us/documents/")
    expect(statementFor("michigan-document-redirect")).toContain("Document download failed with HTTP 302")
    expect(statementFor("michigan-document-redirect")).toContain(
      "^https://(www\\.)?legislature\\.mi\\.gov/Home/GetObject\\?objectName=[A-Za-z0-9_-]+\\.pdf$"
    )
    expect(statementFor("michigan-tls")).toContain("^https?://(www\\.)?legislature\\.mi\\.gov/")
    expect(statementFor("minnesota-senate-resolutions")).toContain("www\\.revisor\\.mn\\.gov/bills")
    expect(statementFor("minnesota-senate-resolutions")).toContain("text\\.php\\?number=SR")
    expect(statementFor("minnesota-senate-resolutions")).toContain("processing_status = 'unsupported'")
    expect(statementFor("nebraska-rate-limited")).toContain("Document download failed with HTTP 429")
    expect(statementFor("nebraska-rate-limited")).toContain("^https?://nebraskalegislature\\.gov/")
    expect(statementFor("new-hampshire-legacy-amendments")).toContain("txtFormat=amend")
    expect(statementFor("new-hampshire-legacy-amendments")).toContain(
      "Document fetch failed (%UND_ERR_SOCKET:%other side closed%)"
    )
    expect(statementFor("new-hampshire-legacy-amendments")).not.toContain("txtFormat=(html|pdf)")
    expect(statementFor("ohio-legislature-tls")).toContain(
      "^https://www\\.legislature\\.ohio\\.gov//?download\\?key=[0-9]+$"
    )
    expect(statementFor("oklahoma-legacy-archive")).toContain(
      "^http://webserver1.lsb.state.ok.us/cf_pdf/[0-9]{4}-[0-9]{2}"
    )
    const pdfFlateStreamOcr = statementFor("pdf-flate-stream-ocr")
    expect(pdfFlateStreamOcr).toContain("processing_status = 'unsupported'")
    expect(pdfFlateStreamOcr).toContain("content_type = 'application/pdf'")
    expect(pdfFlateStreamOcr).toContain("blob_path is not null")
    expect(pdfFlateStreamOcr).toContain("content_hash is null")
    expect(pdfFlateStreamOcr).toContain("processing_error_category = 'malformed-document'")
    expect(pdfFlateStreamOcr).toContain("processing_error = 'Bad uncompressed block length in flate stream'")
    expect(pdfFlateStreamOcr).toContain("ocr_status is null or ocr_status = 'not-required'")
    expect(pdfFlateStreamOcr).toContain("ocr_provider is null")
    expect(pdfFlateStreamOcr).toContain("ocr_completed_at is null")
    expect(pdfFlateStreamOcr).toContain("ocr_page_count is null")
    expect(pdfFlateStreamOcr).toContain("processing_error_category = 'ocr-required'")
    expect(pdfFlateStreamOcr).toContain("ocr_status = 'pending'")
    expect(pdfFlateStreamOcr).not.toContain("blob_path = null")
    expect(pdfFlateStreamOcr).not.toContain("content_type = null")
    expect(pdfFlateStreamOcr).not.toContain("source_url =")
    expect(statementFor("pennsylvania-fiscal-notes")).toContain("WU01/LI/BI/(FN|SFN)/20[0-9]{2}")
    expect(statementFor("pennsylvania-legacy-bill-text")).toContain("txtType=(HTM|PDF)")
    expect(statementFor("rhode-island-legacy-bill-text")).toContain(
      "^http://webserver.rilin.state.ri.us/BillText/BillText([0-9]{2})"
    )
    expect(statementFor("texas-legacy-witness-list")).toContain(
      "^ftp://ftp.legis.state.tx.us/bills/[0-9]{2}(R|[0-9])/witlistbill/html/"
    )
    expect(statementFor("texas-legacy-witness-list")).toContain("processing_status = 'unsupported'")
    expect(statementFor("west-virginia-legacy-origin")).toContain(
      "^http://www.legis.state.wv.us/(Bill_Status|Bill_Text_HTML|legisdocs)/[^#]+$"
    )
    expect(statementFor("vermont-legacy-assets")).toContain("Document download failed with HTTP 404")
    expect(statementFor("vermont-tls")).toContain("^https?://legislature\\.vermont\\.gov/")
    for (const [index, statement] of statements.entries()) {
      if (
        expectedCohorts[index] === "connecticut-ftp" ||
        expectedCohorts[index] === "image-ocr-missing-artifact" ||
        expectedCohorts[index] === "image-ocr-stale-artifact" ||
        expectedCohorts[index] === "michigan-document-redirect" ||
        expectedCohorts[index] === "minnesota-senate-resolutions" ||
        expectedCohorts[index] === "pdf-flate-stream-ocr" ||
        expectedCohorts[index] === "texas-legacy-witness-list" ||
        expectedCohorts[index] === "vermont-legacy-assets"
      ) {
        continue
      }
      expect(statement).toContain("processing_status = 'failed'")
      expect(statement).not.toContain("source_url =")
    }
  })
})
