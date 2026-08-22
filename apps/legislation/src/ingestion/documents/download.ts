import { load } from "cheerio"
import { unzipSync } from "fflate"
import { MAX_DOCUMENT_BYTES } from "./extract.js"
import { fetchDocumentWithTrustedIntermediates, relayedDocumentSource } from "./trusted-document-transport.js"

const supportedMediaTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/xhtml+xml",
  "application/xml",
  "text/html",
  "text/plain",
  "text/xml"
])

const CALIFORNIA_LEGINFO_HOST = "leginfo.legislature.ca.gov"
const CALIFORNIA_BILL_PDF_PATH = "/faces/billPdf.xhtml"
const ARKANSAS_LEGISLATURE_HOST = "www.arkleg.state.ar.us"
const CONNECTICUT_LEGACY_FTP_HOST = "ftp.cga.ct.gov"
const CONNECTICUT_GENERAL_ASSEMBLY_HOST = "www.cga.ct.gov"
const CONNECTICUT_LEGACY_DOCUMENT_PATH =
  /^\/(?:2017|2018)\/tob\/[hs]\/[0-9]{4}[A-Z]{2}-[0-9]{5}-R[0-9]{2}-(?:HB|SB)\.htm$/
const OKLAHOMA_LEGACY_DOCUMENT_HOST = "webserver1.lsb.state.ok.us"
const OKLAHOMA_LEGISLATURE_HOST = "www.oklegislature.gov"
const OKLAHOMA_LEGACY_DOCUMENT_PATH = /^\/cf_pdf\/[0-9]{4}-[0-9]{2}[^?#]*\.pdf$/i
const RHODE_ISLAND_LEGACY_DOCUMENT_HOST = "webserver.rilin.state.ri.us"
const RHODE_ISLAND_LEGISLATURE_HOST = "webserver.rilegislature.gov"
const RHODE_ISLAND_LEGACY_DOCUMENT_PATH = /^\/BillText\/BillText(\d{2})\/(?:House|Senate)Text\1\/[A-Za-z0-9_-]+\.pdf$/i
const WEST_VIRGINIA_LEGACY_DOCUMENT_HOST = "www.legis.state.wv.us"
const WEST_VIRGINIA_LEGISLATURE_HOST = "www.wvlegislature.gov"
const WEST_VIRGINIA_LEGACY_DOCUMENT_PATH = /^\/(?:Bill_Status|Bill_Text_HTML|legisdocs)\/[^#]+$/
const COLORADO_LEGACY_ACQUIA_HOST = "coga.prod.acquia-sites.com"
const COLORADO_LEGISLATURE_HOST = "leg.colorado.gov"
const COLORADO_LEGACY_ATTACHMENT_PATH = /^\/sites\/default\/files\/html-attachments\/[^?#]+\.pdf$/i
const TEXAS_LEGACY_FTP_HOST = "ftp.legis.state.tx.us"
const TEXAS_LEGISLATURE_HOST = "capitol.texas.gov"
const TEXAS_LEGACY_WITNESS_LIST_PATH =
  /^\/bills\/(\d{2}(?:R|\d))\/witlistbill\/html\/(?:house|senate)_(?:bills|concurrent_resolutions|joint_resolutions|resolutions)\/(?:HB|SB|HC|SC|HJ|SJ|HR|SR)\d{5}_(?:HB|SB|HC|SC|HJ|SJ|HR|SR)\d{5}\/((?:HB|SB|HC|SC|HJ|SJ|HR|SR)\d{5}[A-Za-z0-9_-]*\.(?:htm|html))$/i
const MINNESOTA_REVISOR_HOST = "www.revisor.mn.gov"
const MINNESOTA_SENATE_HOST = "www.senate.mn"
const MINNESOTA_REVISOR_TEXT_PATH = "/bills/text.php"
const MINNESOTA_RESOLUTION_PATH =
  /^\/bills\/([0-9]{2})\/((?:19|20)[0-9]{2})\/([0-9]+)\/SR\/([0-9]+)\/versions\/(?:resolution\/)?0(?:\/pdf)?\/$/i
const NEW_HAMPSHIRE_LEGACY_HOST = "www.gencourt.state.nh.us"
const NEW_HAMPSHIRE_CURRENT_HOST = "gc.nh.gov"
const NEW_HAMPSHIRE_RETIRED_BILL_TEXT_PATH = "/bill_status/billText.aspx"
const NEW_HAMPSHIRE_ARCHIVE_BILL_TEXT_PATH = "/bill_status/legacy/bs2016/billText.aspx"
const ILLINOIS_BETA_HOST = "beta.ilga.gov"
const ILLINOIS_GENERAL_ASSEMBLY_HOSTS = new Set(["beta.ilga.gov", "ilga.gov", "www.ilga.gov"])
const ILLINOIS_FULL_TEXT_PATH = "/legislation/fulltext.asp"
const ILLINOIS_DOCUMENT_TYPES = new Set(["AM", "HB", "HJR", "HJRCA", "HR", "SB", "SJR", "SJRCA", "SR"])
const PENNSYLVANIA_LEGACY_HOST = "www.legis.state.pa.us"
const PENNSYLVANIA_LEGACY_BILL_TEXT_PATH = "/cfdocs/legis/pn/public/btcheck.cfm"
const PENNSYLVANIA_BILL_TEXT_TYPES = new Set(["DOC", "HTM", "PDF"])
const OHIO_LEGISLATURE_HOST = "www.legislature.ohio.gov"
const OHIO_LEGACY_DOWNLOAD_PATH = "//download"
const DISTRICT_OF_COLUMBIA_LIMS_HOST = "lims.dccouncil.gov"
const DISTRICT_OF_COLUMBIA_LEGACY_LIMS_HOST = "lims.dccouncil.us"
const DISTRICT_OF_COLUMBIA_LEGACY_DOWNLOAD_PATH = /^\/Download\/([0-9]+)\/([A-Za-z0-9][A-Za-z0-9._-]*\.pdf)$/i
const DISTRICT_OF_COLUMBIA_CANONICAL_DOWNLOAD_PATH =
  /^\/downloads\/LIMS\/([0-9]+)\/(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)+([A-Za-z0-9][A-Za-z0-9._-]*\.pdf)$/i
const HAWAII_LEGACY_CAPITOL_HOSTS = new Set(["capitol.hawaii.gov", "www.capitol.hawaii.gov"])
const HAWAII_DATA_CAPITOL_HOST = "data.capitol.hawaii.gov"
const HAWAII_DOCUMENT_PATH =
  /^\/(?:sessions\/)?(session(?:19|20)\d{2})\/(bills|commreports|testimony)\/([A-Za-z0-9][A-Za-z0-9._-]*\.(?:htm|html|pdf))$/i
const VERMONT_LEGACY_ASSET_HOST = "legislature.vermont.gov"
const VERMONT_LEGACY_ASSET_PATH = /^\/assets(\/Documents\/(?:19|20)\d{2}\/Docs\/[^?#]+)$/i
const KNOWN_INACCESSIBLE_DOCUMENT_HOSTS = new Set(["www.lrc.ky.gov"])
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36"

function isCaliforniaBillPdfUrl(url: URL): boolean {
  return url.hostname === CALIFORNIA_LEGINFO_HOST && url.pathname === CALIFORNIA_BILL_PDF_PATH
}

export function resolveApprovedDocumentUrl(sourceUrl: string): URL {
  const url = new URL(sourceUrl)
  // Open States retained URLs from ILGA's retired beta hostname. The official
  // production host serves the same archive, bill-status, and public-act paths.
  // Normalize only this exact former first-party hostname and preserve the
  // complete path/query before applying any narrower legacy route rewrite.
  if (url.hostname.toLowerCase() === ILLINOIS_BETA_HOST) {
    url.hostname = "ilga.gov"
    url.protocol = "https:"
  }
  const connecticutDocument = resolveConnecticutLegacyDocumentUrl(url)
  if (connecticutDocument !== undefined) {
    return connecticutDocument
  }
  const oklahomaDocument = resolveOklahomaLegacyDocumentUrl(url)
  if (oklahomaDocument !== undefined) {
    return oklahomaDocument
  }
  const rhodeIslandDocument = resolveRhodeIslandLegacyDocumentUrl(url)
  if (rhodeIslandDocument !== undefined) {
    return rhodeIslandDocument
  }
  const westVirginiaDocument = resolveWestVirginiaLegacyDocumentUrl(url)
  if (westVirginiaDocument !== undefined) {
    return westVirginiaDocument
  }
  const coloradoDocument = resolveColoradoLegacyAttachmentUrl(url)
  if (coloradoDocument !== undefined) {
    return coloradoDocument
  }
  const texasDocument = resolveTexasLegacyWitnessListUrl(url)
  if (texasDocument !== undefined) {
    return texasDocument
  }
  const minnesotaResolution = resolveMinnesotaSenateResolutionUrl(url)
  if (minnesotaResolution !== undefined) {
    return minnesotaResolution
  }
  const newHampshireDocument = resolveNewHampshireLegacyAmendmentUrl(url)
  if (newHampshireDocument !== undefined) {
    return newHampshireDocument
  }
  const vermontDocument = resolveVermontLegacyAssetDocumentUrl(url)
  if (vermontDocument !== undefined) {
    return vermontDocument
  }
  if (url.protocol === "ftp:" && url.hostname === ARKANSAS_LEGISLATURE_HOST && url.pathname.startsWith("/Bills/")) {
    const resolved = new URL("https://www.arkleg.state.ar.us/Home/FTPDocument")
    resolved.searchParams.set("path", url.pathname)
    return resolved
  }
  const illinoisDocument = resolveIllinoisFullTextUrl(url)
  if (illinoisDocument !== undefined) {
    return illinoisDocument
  }
  const ohioDocument = resolveOhioLegacyDownloadUrl(url)
  if (ohioDocument !== undefined) {
    return ohioDocument
  }
  const districtOfColumbiaDocument = resolveDistrictOfColumbiaLimsUrl(url)
  if (districtOfColumbiaDocument !== undefined) {
    return districtOfColumbiaDocument
  }
  const pennsylvaniaDocument = resolvePennsylvaniaLegacyBillTextUrl(url)
  if (pennsylvaniaDocument !== undefined) {
    return pennsylvaniaDocument
  }
  const hawaiiDocument = resolveHawaiiArchivedDocumentUrl(url)
  if (hawaiiDocument !== undefined) {
    return hawaiiDocument
  }
  return url
}

/**
 * Connecticut's retired FTP hostname no longer serves the archive, while the
 * General Assembly's HTTPS host serves the identical four session/chamber
 * route families. Keep this to the fully observed document grammar rather
 * than promoting arbitrary FTP paths to the public web host.
 */
function resolveConnecticutLegacyDocumentUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "ftp:" ||
    sourceUrl.hostname.toLowerCase() !== CONNECTICUT_LEGACY_FTP_HOST ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.search.length > 0 ||
    sourceUrl.hash.length > 0 ||
    !CONNECTICUT_LEGACY_DOCUMENT_PATH.test(sourceUrl.pathname)
  ) {
    return undefined
  }
  const resolved = new URL(`https://${CONNECTICUT_GENERAL_ASSEMBLY_HOST}`)
  resolved.pathname = sourceUrl.pathname
  return resolved
}

/**
 * Oklahoma's retired LSB hostname no longer accepts the HTTPS upgrade applied
 * to Open States' historical HTTP links. The Legislature's current bill page
 * links the same session archive artifacts directly from its official host.
 */
function resolveOklahomaLegacyDocumentUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "http:" ||
    sourceUrl.hostname.toLowerCase() !== OKLAHOMA_LEGACY_DOCUMENT_HOST ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.search.length > 0 ||
    sourceUrl.hash.length > 0 ||
    !OKLAHOMA_LEGACY_DOCUMENT_PATH.test(sourceUrl.pathname)
  ) {
    return undefined
  }
  const resolved = new URL(`https://${OKLAHOMA_LEGISLATURE_HOST}`)
  resolved.pathname = sourceUrl.pathname
  return resolved
}

/**
 * Rhode Island's former rilin hostname presents a certificate for neither
 * legacy name nor its successor, preventing Node from following its redirect.
 * Its General Assembly publishes the same BillText archive on the replacement
 * first-party host. Keep the rewrite to the observed session-text PDF grammar.
 */
function resolveRhodeIslandLegacyDocumentUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "http:" ||
    sourceUrl.hostname.toLowerCase() !== RHODE_ISLAND_LEGACY_DOCUMENT_HOST ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.search.length > 0 ||
    sourceUrl.hash.length > 0 ||
    !RHODE_ISLAND_LEGACY_DOCUMENT_PATH.test(sourceUrl.pathname)
  ) {
    return undefined
  }
  const resolved = new URL(`https://${RHODE_ISLAND_LEGISLATURE_HOST}`)
  resolved.pathname = sourceUrl.pathname
  return resolved
}

/**
 * West Virginia's former legis.state origin remains reachable over HTTP but
 * has an invalid HTTPS certificate and has produced retryable fetch failures
 * in the document workers. The current Legislature host serves byte-identical
 * content for the three observed bill-status, bill-text, and legislative-doc
 * archive trees. Retain paths and queries, including Bill_Status identifiers.
 */
function resolveWestVirginiaLegacyDocumentUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "http:" ||
    sourceUrl.hostname.toLowerCase() !== WEST_VIRGINIA_LEGACY_DOCUMENT_HOST ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.hash.length > 0 ||
    !WEST_VIRGINIA_LEGACY_DOCUMENT_PATH.test(sourceUrl.pathname)
  ) {
    return undefined
  }
  const resolved = new URL(`https://${WEST_VIRGINIA_LEGISLATURE_HOST}`)
  resolved.pathname = sourceUrl.pathname
  resolved.search = sourceUrl.search
  return resolved
}

/**
 * Colorado's retired Acquia origin no longer resolves. The Legislature's
 * current official host serves the same historical committee attachment path.
 */
function resolveColoradoLegacyAttachmentUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "http:" ||
    sourceUrl.hostname.toLowerCase() !== COLORADO_LEGACY_ACQUIA_HOST ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.search.length > 0 ||
    sourceUrl.hash.length > 0 ||
    !COLORADO_LEGACY_ATTACHMENT_PATH.test(sourceUrl.pathname)
  ) {
    return undefined
  }
  const resolved = new URL(`https://${COLORADO_LEGISLATURE_HOST}`)
  resolved.pathname = sourceUrl.pathname
  return resolved
}

/**
 * Texas' Open States archive points at the Legislature's historical FTP tree,
 * which the HTTPS-only downloader intentionally rejects. The same official
 * witness-list artifacts are published on capitol.texas.gov under the compact
 * tlodocs route. Keep the stored FTP URL as identity and map only the observed
 * session, chamber, measure-range, and witness-list filename grammar.
 */
function resolveTexasLegacyWitnessListUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "ftp:" ||
    sourceUrl.hostname.toLowerCase() !== TEXAS_LEGACY_FTP_HOST ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.search.length > 0 ||
    sourceUrl.hash.length > 0
  ) {
    return undefined
  }
  const match = TEXAS_LEGACY_WITNESS_LIST_PATH.exec(sourceUrl.pathname)
  if (match?.[1] === undefined || match[2] === undefined) {
    return undefined
  }
  const resolved = new URL(`https://${TEXAS_LEGISLATURE_HOST}`)
  resolved.pathname = `/tlodocs/${match[1]}/witlistbill/html/${match[2]}`
  return resolved
}

/**
 * Minnesota's Revisor redirects Senate resolutions through an HTTP URL before
 * returning to the Senate's HTTPS site. Keep downgrade rejection enabled and
 * map only the two observed first-party resolution grammars to that final HTTPS
 * endpoint.
 */
function resolveMinnesotaSenateResolutionUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "https:" ||
    sourceUrl.hostname.toLowerCase() !== MINNESOTA_REVISOR_HOST ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.hash.length > 0
  ) {
    return undefined
  }

  let legislature: string | undefined
  let sessionYear: string | undefined
  let specialSession: string | undefined
  let billNumber: string | undefined
  if (sourceUrl.pathname === MINNESOTA_REVISOR_TEXT_PATH) {
    const allowedKeys = new Set(["format", "number", "session", "session_number", "session_year", "type", "version"])
    if ([...sourceUrl.searchParams.keys()].some((key) => !allowedKeys.has(key))) {
      return undefined
    }
    const number = sourceUrl.searchParams.get("number") ?? ""
    const session = sourceUrl.searchParams.get("session") ?? ""
    legislature = /^ls([0-9]{2})$/i.exec(session)?.[1]
    billNumber = /^SR([0-9]+)$/i.exec(number)?.[1]
    sessionYear = sourceUrl.searchParams.get("session_year") ?? undefined
    specialSession = sourceUrl.searchParams.get("session_number") ?? undefined
    const format = sourceUrl.searchParams.get("format")
    if (
      sourceUrl.searchParams.get("version") !== "0" ||
      sourceUrl.searchParams.get("type") !== "resolution" ||
      (format !== null && format !== "pdf")
    ) {
      return undefined
    }
  } else {
    const match = MINNESOTA_RESOLUTION_PATH.exec(sourceUrl.pathname)
    if (match === null || sourceUrl.search.length > 0) {
      return undefined
    }
    ;[legislature, sessionYear, specialSession, billNumber] = match.slice(1)
  }
  if (
    legislature === undefined ||
    sessionYear === undefined ||
    !/^(?:19|20)[0-9]{2}$/.test(sessionYear) ||
    specialSession === undefined ||
    !/^[0-9]+$/.test(specialSession) ||
    billNumber === undefined
  ) {
    return undefined
  }

  const resolved = new URL(`https://${MINNESOTA_SENATE_HOST}/resolutions/display_resolution.html`)
  resolved.searchParams.set("ls", legislature)
  resolved.searchParams.set("bill_type", "SR")
  resolved.searchParams.set("bill_number", billNumber.padStart(4, "0"))
  resolved.searchParams.set("ss_number", specialSession)
  resolved.searchParams.set("ss_year", sessionYear)
  return resolved
}

/**
 * New Hampshire retired its pre-2021 billText endpoint, which now redirects
 * to a branded 404 page. The same exact amendment identifier is still served
 * by the Legislature's official legacy archive. Numeric document IDs are not
 * rewritten because bounded checks showed that the publisher now reuses them
 * for different bills.
 */
function resolveNewHampshireLegacyAmendmentUrl(sourceUrl: URL): URL | undefined {
  const sessionYear = sourceUrl.searchParams.get("sy") ?? ""
  const amendmentId = sourceUrl.searchParams.get("id") ?? ""
  const isRetiredRoute =
    sourceUrl.pathname.toLowerCase() === NEW_HAMPSHIRE_RETIRED_BILL_TEXT_PATH.toLowerCase() &&
    /^(?:2017|2018|2019|2020)$/.test(sessionYear)
  const isArchiveRoute =
    sourceUrl.pathname.toLowerCase() === NEW_HAMPSHIRE_ARCHIVE_BILL_TEXT_PATH.toLowerCase() &&
    /^(?:2021|2022)$/.test(sessionYear)
  if (
    sourceUrl.protocol !== "http:" ||
    sourceUrl.hostname.toLowerCase() !== NEW_HAMPSHIRE_LEGACY_HOST ||
    (!isRetiredRoute && !isArchiveRoute) ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.hash.length > 0 ||
    sourceUrl.searchParams.size !== 3 ||
    !/^(?:2017|2018|2019|2020|2021|2022)-[0-9]{4}[hse]$/i.test(amendmentId) ||
    !amendmentId.startsWith(`${sessionYear}-`) ||
    sourceUrl.searchParams.get("txtFormat")?.toLowerCase() !== "amend"
  ) {
    return undefined
  }
  const resolved = new URL(`https://${NEW_HAMPSHIRE_CURRENT_HOST}`)
  resolved.pathname = NEW_HAMPSHIRE_ARCHIVE_BILL_TEXT_PATH
  resolved.search = sourceUrl.search
  return resolved
}

/**
 * Vermont's retired `/assets` prefix returns 404 for the official session
 * archive. The identical artifact is retained under `/Documents`; constrain
 * this to the observed session document tree and keep source identity intact.
 */
function resolveVermontLegacyAssetDocumentUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "https:" ||
    sourceUrl.hostname.toLowerCase() !== VERMONT_LEGACY_ASSET_HOST ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.search.length > 0 ||
    sourceUrl.hash.length > 0
  ) {
    return undefined
  }
  const match = VERMONT_LEGACY_ASSET_PATH.exec(sourceUrl.pathname)
  if (match?.[1] === undefined) {
    return undefined
  }
  const resolved = new URL(`https://${VERMONT_LEGACY_ASSET_HOST}`)
  resolved.pathname = match[1]
  return resolved
}

/**
 * Hawaii's live capitol host is protected by Cloudflare for historical
 * OpenStates document links. The legislature's official data host exposes the
 * same session artifacts beneath /sessions. Rewrite only the documented
 * archive directories and only a single safe file name: unlike a generic host
 * swap, this cannot turn a navigation URL or an arbitrary nested path into a
 * download request.
 */
function resolveHawaiiArchivedDocumentUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "https:" ||
    !HAWAII_LEGACY_CAPITOL_HOSTS.has(sourceUrl.hostname.toLowerCase()) ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.search.length > 0 ||
    sourceUrl.hash.length > 0
  ) {
    return undefined
  }
  const match = HAWAII_DOCUMENT_PATH.exec(sourceUrl.pathname)
  if (match === null) {
    return undefined
  }
  const [, session, collection, fileName] = match
  if (session === undefined || collection === undefined || fileName === undefined) {
    return undefined
  }
  const resolved = new URL(`https://${HAWAII_DATA_CAPITOL_HOST}`)
  let archiveCollection = "Testimony"
  if (collection.toLowerCase() === "bills") {
    archiveCollection = "Bills"
  } else if (collection.toLowerCase() === "commreports") {
    archiveCollection = "CommReports"
  }
  resolved.pathname = `/sessions/${session.toLowerCase()}/${archiveCollection}/${fileName}`
  return resolved
}

/**
 * Open States' historical Illinois fulltext.asp records point to a retired
 * endpoint. The official ILGA archive retains the same named artifact under
 * /documents/legislation/{GA}/{DocTypeId}/PDF/{DocName}.pdf. Restrict this
 * rewrite to the documented query contract instead of guessing arbitrary URLs.
 */
function resolveIllinoisFullTextUrl(sourceUrl: URL): URL | undefined {
  if (
    !ILLINOIS_GENERAL_ASSEMBLY_HOSTS.has(sourceUrl.hostname.toLowerCase()) ||
    sourceUrl.pathname.toLowerCase() !== ILLINOIS_FULL_TEXT_PATH
  ) {
    return undefined
  }
  const documentName = sourceUrl.searchParams.get("DocName")?.trim().toUpperCase()
  const documentType = sourceUrl.searchParams.get("DocTypeId")?.trim().toUpperCase()
  const generalAssembly = sourceUrl.searchParams.get("GA")?.trim()
  if (
    documentName === undefined ||
    documentType === undefined ||
    generalAssembly === undefined ||
    !/^[A-Z0-9]+$/.test(documentName) ||
    !/^\d{1,3}$/.test(generalAssembly) ||
    !ILLINOIS_DOCUMENT_TYPES.has(documentType)
  ) {
    return undefined
  }
  const resolved = new URL("https://ilga.gov")
  resolved.pathname = `/documents/legislation/${generalAssembly}/${documentType}/PDF/${documentName}.pdf`
  return resolved
}

/**
 * Ohio's earlier source exports included a double slash before its download
 * route. The publisher redirects it to the same official single-slash route,
 * but the host-scoped certificate transport intentionally does not follow
 * redirects. Normalize only this proven numeric document key grammar.
 */
function resolveOhioLegacyDownloadUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.protocol !== "https:" ||
    sourceUrl.hostname.toLowerCase() !== OHIO_LEGISLATURE_HOST ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.hash.length > 0 ||
    sourceUrl.pathname !== OHIO_LEGACY_DOWNLOAD_PATH ||
    !/^key=[0-9]+$/.test(sourceUrl.search.slice(1))
  ) {
    return undefined
  }
  const resolved = new URL(`https://${OHIO_LEGISLATURE_HOST}/download`)
  resolved.search = sourceUrl.search
  return resolved
}

/**
 * The former LIMS hostname returns Cloudflare 522 responses for both its
 * canonical archive and legacy `/Download` routes. The Council's current
 * `.gov` hostname serves the same canonical artifacts. Legacy routes must
 * still be resolved through the publisher's own redirect because the category
 * path is not derivable from the source file name alone.
 */
function resolveDistrictOfColumbiaLimsUrl(sourceUrl: URL): URL | undefined {
  const hostname = sourceUrl.hostname.toLowerCase()
  if (
    (sourceUrl.protocol !== "https:" && sourceUrl.protocol !== "http:") ||
    (hostname !== DISTRICT_OF_COLUMBIA_LEGACY_LIMS_HOST && hostname !== DISTRICT_OF_COLUMBIA_LIMS_HOST) ||
    sourceUrl.username.length > 0 ||
    sourceUrl.password.length > 0 ||
    sourceUrl.search.length > 0 ||
    sourceUrl.hash.length > 0 ||
    (!DISTRICT_OF_COLUMBIA_LEGACY_DOWNLOAD_PATH.test(sourceUrl.pathname) &&
      !DISTRICT_OF_COLUMBIA_CANONICAL_DOWNLOAD_PATH.test(sourceUrl.pathname))
  ) {
    return undefined
  }
  const resolved = new URL(sourceUrl)
  resolved.protocol = "https:"
  resolved.hostname = DISTRICT_OF_COLUMBIA_LIMS_HOST
  return resolved
}

async function resolveDistrictOfColumbiaLimsRedirect(
  response: Response,
  sourceUrl: URL,
  fetcher: typeof fetch,
  timeoutMs: number
): Promise<Response> {
  const legacyMatch = DISTRICT_OF_COLUMBIA_LEGACY_DOWNLOAD_PATH.exec(sourceUrl.pathname)
  if (sourceUrl.hostname.toLowerCase() !== DISTRICT_OF_COLUMBIA_LIMS_HOST || legacyMatch === null) {
    return response
  }
  if (response.status < 300 || response.status >= 400) {
    return response
  }
  const location = response.headers.get("location")
  if (location === null) {
    throw new Error("District of Columbia LIMS redirect is missing its artifact location")
  }
  const redirected = new URL(location, sourceUrl)
  const canonicalMatch = DISTRICT_OF_COLUMBIA_CANONICAL_DOWNLOAD_PATH.exec(redirected.pathname)
  if (
    redirected.protocol !== "https:" ||
    redirected.hostname.toLowerCase() !== DISTRICT_OF_COLUMBIA_LEGACY_LIMS_HOST ||
    redirected.username.length > 0 ||
    redirected.password.length > 0 ||
    redirected.search.length > 0 ||
    redirected.hash.length > 0 ||
    canonicalMatch === null ||
    canonicalMatch[1] !== legacyMatch[1] ||
    canonicalMatch[2] !== legacyMatch[2]
  ) {
    throw new Error("District of Columbia LIMS redirect did not match the requested official artifact")
  }
  redirected.hostname = DISTRICT_OF_COLUMBIA_LIMS_HOST
  return await fetcher(redirected, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  })
}

/**
 * Pennsylvania's retired bill-text endpoint redirects to a canonical Palegis
 * artifact. Only rewrite the documented legacy query contract, preserving the
 * source's unambiguous session, bill, and page identifiers.
 */
function resolvePennsylvaniaLegacyBillTextUrl(sourceUrl: URL): URL | undefined {
  if (
    sourceUrl.hostname.toLowerCase() !== PENNSYLVANIA_LEGACY_HOST ||
    sourceUrl.pathname.toLowerCase() !== PENNSYLVANIA_LEGACY_BILL_TEXT_PATH
  ) {
    return undefined
  }
  const documentType = sourceUrl.searchParams.get("txtType")?.trim().toUpperCase()
  const sessionYear = sourceUrl.searchParams.get("sessYr")?.trim()
  const sessionIndex = sourceUrl.searchParams.get("sessInd")?.trim()
  const billBody = sourceUrl.searchParams.get("billBody")?.trim().toUpperCase()
  const billType = sourceUrl.searchParams.get("billTyp")?.trim().toUpperCase()
  const billNumber = sourceUrl.searchParams.get("billNbr")?.trim()
  const pageNumber = sourceUrl.searchParams.get("pn")?.trim()
  if (
    documentType === undefined ||
    !PENNSYLVANIA_BILL_TEXT_TYPES.has(documentType) ||
    sessionYear === undefined ||
    sessionIndex === undefined ||
    billBody === undefined ||
    billType === undefined ||
    billNumber === undefined ||
    pageNumber === undefined ||
    !/^\d{4}$/.test(sessionYear) ||
    !/^\d{1,2}$/.test(sessionIndex) ||
    !/^[A-Z]{1,3}$/.test(billBody) ||
    !/^[A-Z]{1,3}$/.test(billType) ||
    !/^\d{1,6}$/.test(billNumber) ||
    !/^\d{1,8}$/.test(pageNumber)
  ) {
    return undefined
  }
  const resolved = new URL("https://www.palegis.us")
  resolved.pathname = `/legislation/bills/text/${documentType}/${sessionYear}/${sessionIndex}/${billBody}${billType}${billNumber}/PN${pageNumber}`
  return resolved
}

function cookieHeader(response: Response): string | undefined {
  const setCookies = response.headers.getSetCookie?.() ?? []
  const values = setCookies.length > 0 ? setCookies : [response.headers.get("set-cookie") ?? ""]
  const cookies = values.flatMap((value) => {
    const pair = value.split(";", 1)[0]?.trim()
    return pair === undefined || pair.length === 0 ? [] : [pair]
  })
  return cookies.length === 0 ? undefined : cookies.join("; ")
}

function detectOfficeOpenXmlContentType(bytes: Uint8Array): string | undefined {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return undefined
  }
  let entries = 0
  let hasContentTypes = false
  let officeType: string | undefined
  try {
    unzipSync(bytes, {
      filter: (entry) => {
        entries += 1
        if (entries > 5_000) {
          throw new Error("Office document archive has too many entries")
        }
        const name = entry.name.toLowerCase()
        if (name === "[content_types].xml") {
          hasContentTypes = true
        } else if (name === "word/document.xml") {
          officeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        } else if (name === "ppt/presentation.xml") {
          officeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        } else if (name === "xl/workbook.xml") {
          officeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }
        return false
      }
    })
  } catch {
    return undefined
  }
  return hasContentTypes ? officeType : undefined
}

export function detectDocumentContentType(bytes: Uint8Array, declaredContentType = ""): string {
  const declaredMediaType = declaredContentType.split(";", 1)[0]?.trim().toLowerCase() ?? ""
  const prefixBytes = bytes.subarray(0, Math.min(bytes.byteLength, 512))
  const prefix = new TextDecoder("utf-8", { fatal: false }).decode(prefixBytes).trimStart().toLowerCase()
  if (prefix.startsWith("%pdf-")) {
    return "application/pdf"
  }
  if (prefixBytes.length >= 6 && (prefix.startsWith("gif87a") || prefix.startsWith("gif89a"))) {
    return "image/gif"
  }
  if (
    prefixBytes.length >= 8 &&
    prefixBytes[0] === 0x89 &&
    prefixBytes[1] === 0x50 &&
    prefixBytes[2] === 0x4e &&
    prefixBytes[3] === 0x47
  ) {
    return "image/png"
  }
  if (prefixBytes.length >= 3 && prefixBytes[0] === 0xff && prefixBytes[1] === 0xd8 && prefixBytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    prefixBytes.length >= 4 &&
    ((prefixBytes[0] === 0x49 && prefixBytes[1] === 0x49 && prefixBytes[2] === 0x2a && prefixBytes[3] === 0) ||
      (prefixBytes[0] === 0x4d && prefixBytes[1] === 0x4d && prefixBytes[2] === 0 && prefixBytes[3] === 0x2a))
  ) {
    return "image/tiff"
  }
  if (prefixBytes.length >= 2 && prefixBytes[0] === 0x42 && prefixBytes[1] === 0x4d) {
    return "image/bmp"
  }
  if (prefixBytes.length >= 12 && prefix.startsWith("riff") && prefix.slice(8, 12) === "webp") {
    return "image/webp"
  }
  if (
    prefix.startsWith("<!doctype html") ||
    prefix.startsWith("<html") ||
    prefix.startsWith("<head") ||
    prefix.startsWith("<body")
  ) {
    if (declaredMediaType === "application/pdf") {
      const htmlPrefix = new TextDecoder("utf-8", { fatal: false })
        .decode(bytes.subarray(0, Math.min(bytes.byteLength, 64 * 1024)))
        .toLowerCase()
      if (htmlPrefix.includes("not found | committee repository | u.s. house of representatives")) {
        throw new Error("Congress committee repository reports document not found")
      }
      throw new Error("Document response contains HTML instead of advertised PDF")
    }
    return "text/html"
  }
  if (prefix.startsWith("<?xml")) {
    return "application/xml"
  }
  if (prefix.startsWith("{\\rtf")) {
    return "application/rtf"
  }
  const officeContentType = detectOfficeOpenXmlContentType(bytes)
  if (officeContentType !== undefined) {
    return officeContentType
  }
  if (supportedMediaTypes.has(declaredMediaType) || declaredMediaType.endsWith("+xml")) {
    return declaredContentType
  }
  const containsNull = prefixBytes.includes(0)
  const printableBytes = prefixBytes.filter(
    (value) => value === 9 || value === 10 || value === 13 || (value >= 32 && value !== 127)
  ).length
  if (!containsNull && prefixBytes.length > 0 && printableBytes / prefixBytes.length >= 0.9) {
    return "text/plain"
  }
  throw new Error(`Unsupported document content type: ${declaredContentType || "missing"}`)
}

export interface DownloadedDocument {
  bytes: Uint8Array
  contentType: string
  sourceUrl: string
}

/**
 * Reads a response incrementally so an origin that omits Content-Length cannot
 * make a document worker buffer an arbitrarily large body before the document
 * size policy is applied. The final allocation is made only after the stream
 * is known to be within the configured bound.
 */
async function readResponseBytes(response: Response, maximumBytes: number): Promise<Uint8Array> {
  if (response.body === null) {
    return new Uint8Array()
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      byteLength += value.byteLength
      if (byteLength > maximumBytes) {
        await reader.cancel()
        throw new Error(`Document exceeds the ${maximumBytes} byte limit`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

async function resolveCaliforniaBillPdf(
  response: Response,
  sourceUrl: URL,
  fetcher: typeof fetch,
  timeoutMs: number
): Promise<Response> {
  if (
    !isCaliforniaBillPdfUrl(sourceUrl) ||
    !response.headers.get("content-type")?.toLowerCase().startsWith("text/html")
  ) {
    return response
  }
  const $ = load(await response.text(), { xml: true })
  const form = $("form#downloadForm")
  const viewState = form.find('input[name="javax.faces.ViewState"]').attr("value")
  const billId = sourceUrl.searchParams.get("bill_id")
  const version = sourceUrl.searchParams.get("version")
  if (viewState === undefined || billId === null || version === null) {
    throw new Error("California bill PDF download form is incomplete")
  }
  const action = form.attr("action") ?? sourceUrl.pathname
  const body = new URLSearchParams({
    "javax.faces.ViewState": viewState,
    bill_id: billId,
    downloadForm: "downloadForm",
    pdf_link2: "pdf_link2",
    version
  })
  return fetcher(new URL(action, sourceUrl), {
    body,
    headers: {
      accept: "application/pdf,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "content-type": "application/x-www-form-urlencoded",
      ...(cookieHeader(response) === undefined ? {} : { cookie: cookieHeader(response) }),
      origin: sourceUrl.origin,
      referer: sourceUrl.href,
      "user-agent": BROWSER_USER_AGENT
    },
    method: "POST",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  })
}

export async function downloadDocument(
  sourceUrl: string,
  options: {
    allowHttp?: boolean
    detectContentType?: boolean
    fetch?: typeof fetch
    maximumBytes?: number
    timeoutMs?: number
  } = {}
): Promise<DownloadedDocument> {
  const url = resolveApprovedDocumentUrl(sourceUrl)
  if (KNOWN_INACCESSIBLE_DOCUMENT_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error(`Document source is inaccessible: ${url.hostname.toLowerCase()}`)
  }
  if (url.protocol === "http:" && options.allowHttp !== true) {
    url.protocol = "https:"
  } else if (url.protocol !== "https:" && !(options.allowHttp === true && url.protocol === "http:")) {
    throw new Error("Document URL must use HTTPS")
  }
  const maximumBytes = options.maximumBytes ?? MAX_DOCUMENT_BYTES
  const baseFetcher: typeof fetch =
    options.fetch ??
    (async (request, init) => await fetchDocumentWithTrustedIntermediates(fetchRequestUrl(request), init ?? {}))
  const fetcher: typeof fetch = async (request, init) => {
    try {
      return await baseFetcher(request, init)
    } catch (error) {
      throw documentNetworkError(error)
    }
  }
  const timeoutMs = options.timeoutMs ?? 30_000
  const districtOfColumbiaLegacyDownload = DISTRICT_OF_COLUMBIA_LEGACY_DOWNLOAD_PATH.test(url.pathname)
  const initialResponse = await fetcher(url, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    redirect: districtOfColumbiaLegacyDownload ? "manual" : "follow",
    signal: AbortSignal.timeout(timeoutMs)
  })
  const districtOfColumbiaResponse = await resolveDistrictOfColumbiaLimsRedirect(
    initialResponse,
    url,
    fetcher,
    timeoutMs
  )
  const response = await resolveCaliforniaBillPdf(districtOfColumbiaResponse, url, fetcher, timeoutMs)
  if (!response.ok) {
    throw new Error(`Document download failed with HTTP ${response.status}`)
  }
  const finalUrl = relayedDocumentSource(response) ?? new URL(response.url || url)
  if (finalUrl.protocol !== "https:" && !(options.allowHttp === true && finalUrl.protocol === "http:")) {
    throw new Error("Document redirect changed to an unsupported protocol")
  }

  const contentLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error(`Document exceeds the ${maximumBytes} byte limit`)
  }
  const bytes = await readResponseBytes(response, maximumBytes)
  const contentType =
    options.detectContentType === false
      ? (response.headers.get("content-type") ?? "application/octet-stream")
      : detectDocumentContentType(bytes, response.headers.get("content-type") ?? "")
  if (isCaliforniaBillPdfUrl(url) && contentType !== "application/pdf") {
    throw new Error(`California bill PDF is not available from publisher (received ${contentType})`)
  }
  return { bytes, contentType, sourceUrl: finalUrl.href }
}

function fetchRequestUrl(request: URL | Request | string): URL {
  if (request instanceof URL) {
    return request
  }
  return new URL(request instanceof Request ? request.url : request)
}

/**
 * Native fetch deliberately keeps its public message generic and places the
 * actionable DNS/TLS/socket reason in `cause`. Persist only bounded network
 * diagnostics, never the request URL or its potentially sensitive query.
 */
function documentNetworkError(error: unknown): Error {
  const outer = error instanceof Error ? `${error.name}: ${safeNetworkDetail(error.message)}` : "unknown error"
  const cause = error instanceof Error ? error.cause : undefined
  const causeCode = networkErrorField(cause, "code")
  const causeName = cause instanceof Error ? cause.name : undefined
  const causeMessage = cause instanceof Error ? safeNetworkDetail(cause.message) : undefined
  const causeSummary = [causeCode, causeName, causeMessage].filter(
    (value, index, values): value is string => value !== undefined && values.indexOf(value) === index
  )
  return new Error(
    `Document fetch failed (${outer}${causeSummary.length === 0 ? "" : `; cause: ${causeSummary.join(": ")}`})`,
    { cause: error }
  )
}

function networkErrorField(error: unknown, field: string): string | undefined {
  if (typeof error !== "object" || error === null || !(field in error)) {
    return undefined
  }
  const value = Reflect.get(error, field)
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : undefined
}

function safeNetworkDetail(value: string): string {
  return value
    .replaceAll(/https?:\/\/\S+/gi, "[url]")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, 240)
}
