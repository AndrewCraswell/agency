import { zipSync } from "fflate"
import { afterEach, describe, expect, it, vi } from "vitest"
import { detectDocumentContentType, downloadDocument, resolveApprovedDocumentUrl } from "./download.js"
import {
  fetchDocumentWithTrustedIntermediates,
  isApprovedDocumentRelayUrl,
  usesFreshConnectionDocumentTransport,
  usesTrustedDocumentTransport
} from "./trusted-document-transport.js"

describe("document downloads", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("upgrades legacy HTTP source links to HTTPS", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("SECTION 1. Secure text.", {
        headers: { "content-type": "text/plain" },
        status: 200
      })
    )

    await expect(downloadDocument("http://example.gov/bill.txt", { fetch: fetcher })).resolves.toMatchObject({
      contentType: "text/plain"
    })
    expect(fetcher).toHaveBeenCalledWith(new URL("https://example.gov/bill.txt"), expect.any(Object))
  })

  it("falls back from an unavailable Alaska bill-text page to the official plaintext route", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("publisher error", { status: 500 }))
      .mockResolvedValueOnce(
        new Response("HOUSE BILL NO. 9050\nAn Act relating to a test.", {
          headers: { "content-type": "text/plain" },
          status: 200
        })
      )
    const sourceUrl = "https://www.akleg.gov/basis/Bill/Text/34?Hsid=HB9050A"

    await expect(downloadDocument(sourceUrl, { fetch: fetcher })).resolves.toMatchObject({
      contentType: "text/plain",
      sourceUrl: "https://www.akleg.gov/basis/Bill/Plaintext/34?Hsid=HB9050A"
    })
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      new URL("https://www.akleg.gov/basis/Bill/Plaintext/34?Hsid=HB9050A"),
      expect.any(Object)
    )
  })

  it("retains the original Alaska response when both official text routes fail", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("publisher error", { status: 500 }))
      .mockResolvedValueOnce(new Response("publisher error", { status: 503 }))

    await expect(
      downloadDocument("https://www.akleg.gov/basis/Bill/Text/34?Hsid=HB9050B", { fetch: fetcher })
    ).rejects.toThrow("Document download failed with HTTP 500")
  })

  it("maps the retired Arkansas FTP endpoint to its approved HTTPS download route", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("%PDF-test", {
        headers: { "content-type": "application/pdf" },
        status: 200
      })
    )

    await expect(
      downloadDocument("ftp://www.arkleg.state.ar.us/Bills/2017S1/Public/HB1001.pdf", { fetch: fetcher })
    ).resolves.toMatchObject({ contentType: "application/pdf" })
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://www.arkleg.state.ar.us/Home/FTPDocument?path=%2FBills%2F2017S1%2FPublic%2FHB1001.pdf"),
      expect.any(Object)
    )
  })

  it("maps only Connecticut's observed legacy FTP archive grammar to its official HTTPS host", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("SECTION 1. Official text.", { headers: { "content-type": "text/html" } }))
    const sourceUrl = "ftp://ftp.cga.ct.gov/2018/tob/h/2018HR-00001-R00-HB.htm"

    await expect(downloadDocument(sourceUrl, { fetch: fetcher })).resolves.toMatchObject({ contentType: "text/html" })
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://www.cga.ct.gov/2018/tob/h/2018HR-00001-R00-HB.htm"),
      expect.any(Object)
    )
    expect(resolveApprovedDocumentUrl("ftp://ftp.cga.ct.gov/2019/tob/h/2019HB-05001-R00-HB.htm").href).toBe(
      "ftp://ftp.cga.ct.gov/2019/tob/h/2019HB-05001-R00-HB.htm"
    )
    expect(resolveApprovedDocumentUrl("ftp://ftp.cga.ct.gov/2018/tob/h/2018HB-05001-R00-HB.htm?download=1").href).toBe(
      "ftp://ftp.cga.ct.gov/2018/tob/h/2018HB-05001-R00-HB.htm?download=1"
    )
  })

  it("maps Oklahoma's observed retired archive grammar to the Legislature's official host", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("%PDF-test", { headers: { "content-type": "application/pdf" } }))
    const sourceUrl = "http://webserver1.lsb.state.ok.us/cf_pdf/2019-20 ENR/hB/HB2424 ENR.PDF"

    await expect(downloadDocument(sourceUrl, { fetch: fetcher })).resolves.toMatchObject({
      contentType: "application/pdf"
    })
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://www.oklegislature.gov/cf_pdf/2019-20%20ENR/hB/HB2424%20ENR.PDF"),
      expect.any(Object)
    )
    expect(
      resolveApprovedDocumentUrl("http://webserver1.lsb.state.ok.us/cf_pdf/2021-22 FLR/HFLR/HB1005 HFLR.PDF").href
    ).toBe("https://www.oklegislature.gov/cf_pdf/2021-22%20FLR/HFLR/HB1005%20HFLR.PDF")
    expect(resolveApprovedDocumentUrl(`${sourceUrl}?download=1`).href).toBe(
      "http://webserver1.lsb.state.ok.us/cf_pdf/2019-20%20ENR/hB/HB2424%20ENR.PDF?download=1"
    )
  })

  it("maps Rhode Island's observed legacy bill-text PDF grammar to the General Assembly host", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("%PDF-test", { headers: { "content-type": "application/pdf" } }))
    const sourceUrl = "http://webserver.rilin.state.ri.us/BillText/BillText22/HouseText22/H7831.pdf"

    await expect(downloadDocument(sourceUrl, { fetch: fetcher })).resolves.toMatchObject({
      contentType: "application/pdf"
    })
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://webserver.rilegislature.gov/BillText/BillText22/HouseText22/H7831.pdf"),
      expect.any(Object)
    )
    expect(
      resolveApprovedDocumentUrl("http://webserver.rilin.state.ri.us/BillText/BillText22/HouseText21/H7831.pdf").href
    ).toBe("http://webserver.rilin.state.ri.us/BillText/BillText22/HouseText21/H7831.pdf")
    expect(resolveApprovedDocumentUrl(`${sourceUrl}?download=1`).href).toBe(
      "http://webserver.rilin.state.ri.us/BillText/BillText22/HouseText22/H7831.pdf?download=1"
    )
  })

  it("maps only West Virginia's observed legacy document trees to the official Legislature host", () => {
    expect(
      resolveApprovedDocumentUrl(
        "http://www.legis.state.wv.us/Bill_Status/bills_text.cfm?billdoc=sb423%20sub1.htm&yr=2023&sesstype=RS&i=423"
      )
    ).toEqual(
      new URL(
        "https://www.wvlegislature.gov/Bill_Status/bills_text.cfm?billdoc=sb423%20sub1.htm&yr=2023&sesstype=RS&i=423"
      )
    )
    expect(
      resolveApprovedDocumentUrl(
        "http://www.gencourt.state.nh.us/bill_status/legacy/bs2016/billText.aspx?sy=2022&id=2022-0679h&txtFormat=amend"
      )
    ).toEqual(
      new URL("https://gc.nh.gov/bill_status/legacy/bs2016/billText.aspx?sy=2022&id=2022-0679h&txtFormat=amend")
    )
    expect(
      resolveApprovedDocumentUrl(
        "http://www.legis.state.wv.us/Bill_Text_HTML/2023_SESSIONS/RS/bills/hb2351%20intr.docx"
      )
    ).toEqual(new URL("https://www.wvlegislature.gov/Bill_Text_HTML/2023_SESSIONS/RS/bills/hb2351%20intr.docx"))
    expect(
      resolveApprovedDocumentUrl(
        "http://www.legis.state.wv.us/legisdocs/chamber/2023/RS/floor_amends/hb2026%20sfat%20weld%20_2%203-9%20adopted.htm"
      )
    ).toEqual(
      new URL(
        "https://www.wvlegislature.gov/legisdocs/chamber/2023/RS/floor_amends/hb2026%20sfat%20weld%20_2%203-9%20adopted.htm"
      )
    )

    expect(
      resolveApprovedDocumentUrl("https://www.legis.state.wv.us/Bill_Status/bills_text.cfm?billdoc=sb423.htm").href
    ).toBe("https://www.legis.state.wv.us/Bill_Status/bills_text.cfm?billdoc=sb423.htm")
    expect(resolveApprovedDocumentUrl("http://www.legis.state.wv.us/Calendar/2023/calendar.htm").href).toBe(
      "http://www.legis.state.wv.us/Calendar/2023/calendar.htm"
    )
    expect(
      resolveApprovedDocumentUrl("http://www.legis.state.wv.us/Bill_Status/bills_text.cfm?billdoc=sb423.htm#section-1")
        .href
    ).toBe("http://www.legis.state.wv.us/Bill_Status/bills_text.cfm?billdoc=sb423.htm#section-1")
  })

  it("maps only Colorado's retired Acquia PDF attachments to the official Legislature host", () => {
    const source =
      "http://coga.prod.acquia-sites.com/sites/default/files/html-attachments/s_ed_2017a_20170420t133424z2__hearing_summary/17SenateEd0420AttachC.pdf"

    expect(resolveApprovedDocumentUrl(source)).toEqual(
      new URL(
        "https://leg.colorado.gov/sites/default/files/html-attachments/s_ed_2017a_20170420t133424z2__hearing_summary/17SenateEd0420AttachC.pdf"
      )
    )
    expect(resolveApprovedDocumentUrl(`${source}?download=1`).href).toBe(`${source}?download=1`)
    expect(resolveApprovedDocumentUrl(source.replace(".pdf", ".docx")).href).toBe(source.replace(".pdf", ".docx"))
    expect(resolveApprovedDocumentUrl(source.replace("http:", "https:")).href).toBe(source.replace("http:", "https:"))
  })

  it("maps only Texas' legacy FTP witness-list artifacts to the official HTTPS archive", () => {
    expect(
      resolveApprovedDocumentUrl(
        "ftp://ftp.legis.state.tx.us/bills/89R/witlistbill/html/house_bills/HB00001_HB00099/HB00009H.htm"
      )
    ).toEqual(new URL("https://capitol.texas.gov/tlodocs/89R/witlistbill/html/HB00009H.htm"))
    expect(
      resolveApprovedDocumentUrl(
        "ftp://ftp.legis.state.tx.us/bills/851/witlistbill/html/senate_bills/SB00001_SB00099/SB00001S.HTM"
      )
    ).toEqual(new URL("https://capitol.texas.gov/tlodocs/851/witlistbill/html/SB00001S.HTM"))
    expect(
      resolveApprovedDocumentUrl(
        "ftp://ftp.legis.state.tx.us/bills/86R/witlistbill/html/house_concurrent_resolutions/HC00001_HC00099/HC00019H.htm"
      )
    ).toEqual(new URL("https://capitol.texas.gov/tlodocs/86R/witlistbill/html/HC00019H.htm"))

    for (const sourceUrl of [
      "ftp://ftp.legis.state.tx.us/bills/89R/billtext/html/house_bills/HB00001_HB00099/HB00009I.htm",
      "ftp://ftp.legis.state.tx.us/bills/89R/witlistbill/html/house_bills/HB00001_HB00099/HB00009H.htm?download=1",
      "ftp://user@ftp.legis.state.tx.us/bills/89R/witlistbill/html/house_bills/HB00001_HB00099/HB00009H.htm"
    ]) {
      expect(resolveApprovedDocumentUrl(sourceUrl).href).toBe(sourceUrl)
    }
  })

  it("maps Minnesota Senate resolutions directly to the official HTTPS destination", () => {
    const expected =
      "https://www.senate.mn/resolutions/display_resolution.html?ls=93&bill_type=SR&bill_number=0052&ss_number=0&ss_year=2023"
    expect(
      resolveApprovedDocumentUrl(
        "https://www.revisor.mn.gov/bills/text.php?number=SR52&version=0&session=ls93&session_year=2023&session_number=0&type=resolution&format=pdf"
      ).href
    ).toBe(expected)
    expect(resolveApprovedDocumentUrl("https://www.revisor.mn.gov/bills/93/2023/0/SR/52/versions/0/").href).toBe(
      expected
    )
    for (const sourceUrl of [
      "https://www.revisor.mn.gov/bills/text.php?number=SF52&version=0&session=ls93&session_year=2023&session_number=0&type=bill",
      "https://www.revisor.mn.gov/bills/93/2023/0/SF/52/versions/0/",
      "https://www.revisor.mn.gov/bills/93/2023/0/SR/52/versions/0/?download=1"
    ]) {
      expect(resolveApprovedDocumentUrl(sourceUrl).href).toBe(sourceUrl)
    }
  })

  it("maps only New Hampshire's retired amendment endpoint to its official legacy archive", () => {
    expect(
      resolveApprovedDocumentUrl(
        "http://www.gencourt.state.nh.us/bill_status/billText.aspx?sy=2020&id=2020-0621s&txtFormat=amend"
      )
    ).toEqual(
      new URL("https://gc.nh.gov/bill_status/legacy/bs2016/billText.aspx?sy=2020&id=2020-0621s&txtFormat=amend")
    )

    for (const sourceUrl of [
      "http://www.gencourt.state.nh.us/bill_status/billText.aspx?sy=2020&id=1027&txtFormat=html",
      "http://www.gencourt.state.nh.us/bill_status/billText.aspx?sy=2020&id=2020-0621s&txtFormat=pdf",
      "http://www.gencourt.state.nh.us/bill_status/billText.aspx?sy=2020&id=2020-0621s&txtFormat=amend&v=current",
      "https://www.gencourt.state.nh.us/bill_status/billText.aspx?sy=2020&id=2020-0621s&txtFormat=amend"
    ]) {
      expect(resolveApprovedDocumentUrl(sourceUrl).href).toBe(sourceUrl)
    }
  })

  it("resolves a District of Columbia legacy LIMS route through its validated official artifact redirect", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            location: "https://lims.dccouncil.us/downloads/LIMS/37138/Meeting1/Enrollment/B22-0007-Enrollment.pdf"
          },
          status: 302
        })
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
          headers: { "content-type": "application/pdf" },
          status: 200
        })
      )

    const result = await downloadDocument("http://lims.dccouncil.us/Download/37138/B22-0007-Enrollment.pdf", {
      fetch: fetcher
    })

    expect(result.contentType).toBe("application/pdf")
    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      new URL("https://lims.dccouncil.gov/Download/37138/B22-0007-Enrollment.pdf"),
      expect.objectContaining({ redirect: "manual" })
    )
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      new URL("https://lims.dccouncil.gov/downloads/LIMS/37138/Meeting1/Enrollment/B22-0007-Enrollment.pdf"),
      expect.objectContaining({ redirect: "follow" })
    )
  })

  it("maps canonical District of Columbia LIMS artifacts away from the retired host", () => {
    expect(
      resolveApprovedDocumentUrl("https://lims.dccouncil.us/downloads/LIMS/37138/Signed_Act/B22-0007-SignedAct.pdf")
    ).toEqual(new URL("https://lims.dccouncil.gov/downloads/LIMS/37138/Signed_Act/B22-0007-SignedAct.pdf"))
  })

  it("rejects a District of Columbia LIMS redirect for a different artifact", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        headers: {
          location: "https://lims.dccouncil.us/downloads/LIMS/99999/Introduction/other.pdf"
        },
        status: 302
      })
    )

    await expect(
      downloadDocument("https://lims.dccouncil.gov/Download/37138/B22-0007-Introduction.pdf", { fetch: fetcher })
    ).rejects.toThrow("District of Columbia LIMS redirect did not match the requested official artifact")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("maps Vermont's retired assets prefix to the official Documents archive", () => {
    expect(
      resolveApprovedDocumentUrl(
        "https://legislature.vermont.gov/assets/Documents/2018/Docs/BILLS/H-0614/H-0614%20As%20Introduced.pdf"
      )
    ).toEqual(new URL("https://legislature.vermont.gov/Documents/2018/Docs/BILLS/H-0614/H-0614%20As%20Introduced.pdf"))
    expect(
      resolveApprovedDocumentUrl(
        "https://legislature.vermont.gov/assets/Documents/2018/Docs/ACTS/ACT101/ACT101%20As%20Enacted.pdf"
      )
    ).toEqual(new URL("https://legislature.vermont.gov/Documents/2018/Docs/ACTS/ACT101/ACT101%20As%20Enacted.pdf"))
    expect(
      resolveApprovedDocumentUrl(
        "https://legislature.vermont.gov/assets/Documents/2018/Docs/RESOLUTN/HCR398/HCR398%20As%20Introduced.pdf"
      )
    ).toEqual(
      new URL("https://legislature.vermont.gov/Documents/2018/Docs/RESOLUTN/HCR398/HCR398%20As%20Introduced.pdf")
    )
    expect(
      resolveApprovedDocumentUrl(
        "https://legislature.vermont.gov/assets/Documents/2018/Docs/BILLS/H-0614/H-0614%20As%20Introduced.pdf?download=1"
      ).href
    ).toBe(
      "https://legislature.vermont.gov/assets/Documents/2018/Docs/BILLS/H-0614/H-0614%20As%20Introduced.pdf?download=1"
    )
    expect(
      resolveApprovedDocumentUrl("https://legislature.vermont.gov/assets/Documents/2018/Other/H-0614/H-0614.pdf").href
    ).toBe("https://legislature.vermont.gov/assets/Documents/2018/Other/H-0614/H-0614.pdf")
  })

  it("uses supplemental TLS chains for only the exact incomplete official hosts", () => {
    expect(usesTrustedDocumentTransport(new URL("https://www.cga.ct.gov/2019/TOB/h/pdf/2019HB-06000-R00-HB.PDF"))).toBe(
      true
    )
    expect(
      usesTrustedDocumentTransport(
        new URL("https://billstatus.ls.state.ms.us/documents/2024/pdf/HB/1800-1899/HB1811IN.pdf")
      )
    ).toBe(true)
    expect(
      usesTrustedDocumentTransport(
        new URL("https://legislature.mi.gov/documents/2021-2022/billintroduced/Senate/pdf/2022-SIB-1048.pdf")
      )
    ).toBe(true)
    expect(
      usesTrustedDocumentTransport(
        new URL("https://www.legislature.mi.gov/documents/2017-2018/billintroduced/House/htm/2017-HIB-4007.htm")
      )
    ).toBe(true)
    expect(usesTrustedDocumentTransport(new URL("https://www.legislature.ohio.gov/download?key=25019"))).toBe(true)
    expect(
      usesTrustedDocumentTransport(
        new URL("https://legislature.vermont.gov/Documents/2020/Docs/BILLS/H-0771/H-0771%20As%20Introduced.pdf")
      )
    ).toBe(true)
    expect(usesTrustedDocumentTransport(new URL("http://www.cga.ct.gov/2019/TOB/h/pdf/2019HB-06000-R00-HB.PDF"))).toBe(
      false
    )
    expect(usesTrustedDocumentTransport(new URL("https://subdomain.cga.ct.gov/document.pdf"))).toBe(false)
    expect(usesTrustedDocumentTransport(new URL("https://example.gov/document.pdf"))).toBe(false)
  })

  it("uses fresh TLS connections for only New Hampshire's exact official hosts", () => {
    expect(usesFreshConnectionDocumentTransport(new URL("https://gc.nh.gov/bill_status/legacy/document.pdf"))).toBe(
      true
    )
    expect(
      usesFreshConnectionDocumentTransport(new URL("https://www.gencourt.state.nh.us/bill_status/document.pdf"))
    ).toBe(true)
    expect(usesFreshConnectionDocumentTransport(new URL("http://gc.nh.gov/bill_status/document.pdf"))).toBe(false)
    expect(usesFreshConnectionDocumentTransport(new URL("https://subdomain.gc.nh.gov/document.pdf"))).toBe(false)
    expect(usesFreshConnectionDocumentTransport(new URL("https://example.gov/document.pdf"))).toBe(false)
  })

  it("follows a validated relative redirect while retaining trusted document transport", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: { location: "/documents/2023-2024/billcurrentversion/Senate/PDF/2023-SCVBS-0654-00D47.PDF" },
          status: 302
        })
      )
      .mockResolvedValueOnce(new Response("%PDF-test", { headers: { "content-type": "application/pdf" }, status: 200 }))
    vi.stubGlobal("fetch", fetcher)

    await expect(
      fetchDocumentWithTrustedIntermediates(
        new URL("https://example.gov/Home/GetObject?objectName=2023-SCVBS-0654-00D47.pdf"),
        { redirect: "follow" }
      )
    ).resolves.toMatchObject({ status: 200 })
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      new URL("https://example.gov/documents/2023-2024/billcurrentversion/Senate/PDF/2023-SCVBS-0654-00D47.PDF"),
      expect.objectContaining({ redirect: "manual" })
    )
  })

  it("maps Illinois' retired full-text endpoint to its matching official PDF archive", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("%PDF-test", { headers: { "content-type": "application/pdf" }, status: 200 }))

    await expect(
      downloadDocument(
        "http://www.ilga.gov/legislation/fulltext.asp?DocName=10000HB1000&GA=100&DocTypeId=HB&LegID=101472",
        { fetch: fetcher }
      )
    ).resolves.toMatchObject({ contentType: "application/pdf" })
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://ilga.gov/documents/legislation/100/HB/PDF/10000HB1000.pdf"),
      expect.any(Object)
    )

    expect(
      resolveApprovedDocumentUrl(
        "https://beta.ilga.gov/legislation/fulltext.asp?DocName=10000HB1000&GA=100&DocTypeId=HB"
      )
    ).toEqual(new URL("https://ilga.gov/documents/legislation/100/HB/PDF/10000HB1000.pdf"))
    expect(
      resolveApprovedDocumentUrl("https://beta.ilga.gov/documents/legislation/103/HB/PDF/10300HB1132eng.pdf")
    ).toEqual(new URL("https://ilga.gov/documents/legislation/103/HB/PDF/10300HB1132eng.pdf"))
    expect(
      resolveApprovedDocumentUrl(
        "https://beta.ilga.gov/Legislation/BillStatus/FullText?LegDocId=179472&DocName=10300SB0045"
      )
    ).toEqual(new URL("https://ilga.gov/Legislation/BillStatus/FullText?LegDocId=179472&DocName=10300SB0045"))
    expect(resolveApprovedDocumentUrl("https://beta.ilga.gov/Legislation/PublicActs/View/103-0030")).toEqual(
      new URL("https://ilga.gov/Legislation/PublicActs/View/103-0030")
    )
  })

  it("fails known inaccessible legacy hosts without making a network request", async () => {
    const fetcher = vi.fn<typeof fetch>()

    await expect(
      downloadDocument("http://www.lrc.ky.gov/recorddocuments/bill/17RS/HB79/bill.pdf", { fetch: fetcher })
    ).rejects.toThrow("Document source is inaccessible: www.lrc.ky.gov")
    expect(fetcher).not.toHaveBeenCalled()
  })

  it("does not rewrite Illinois full-text URLs without an evidenced archive contract", () => {
    expect(
      resolveApprovedDocumentUrl("https://ilga.gov/legislation/fulltext.asp?DocName=bad&GA=100&DocTypeId=UNKNOWN").href
    ).toBe("https://ilga.gov/legislation/fulltext.asp?DocName=bad&GA=100&DocTypeId=UNKNOWN")
  })

  it("maps Pennsylvania's retired bill-text route to its canonical official artifact", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), {
        headers: { "content-type": "application/msword" },
        status: 200
      })
    )
    const sourceUrl =
      "http://www.legis.state.pa.us/CFDOCS/Legis/PN/Public/btCheck.cfm?txtType=DOC&sessYr=2021&sessInd=0&billBody=H&billTyp=R&billNbr=0170&pn=2702"

    await expect(downloadDocument(sourceUrl, { fetch: fetcher })).rejects.toMatchObject({
      name: "DocumentExtractionError",
      category: "unsupported-format",
      message: "Unsupported document content type: application/msword"
    })
    expect(fetcher).toHaveBeenCalledWith(
      new URL("https://www.palegis.us/legislation/bills/text/DOC/2021/0/HR0170/PN2702"),
      expect.any(Object)
    )
    expect(
      resolveApprovedDocumentUrl(
        "http://www.legis.state.pa.us/CFDOCS/Legis/PN/Public/btCheck.cfm?txtType=HTM&sessYr=2021&sessInd=0&billBody=H&billTyp=B&billNbr=2882&pn=3549"
      ).href
    ).toBe("https://www.palegis.us/legislation/bills/text/HTM/2021/0/HB2882/PN3549")
    expect(
      resolveApprovedDocumentUrl(
        "http://www.legis.state.pa.us/CFDOCS/Legis/PN/Public/btCheck.cfm?txtType=PDF&sessYr=2021&sessInd=0&billBody=H&billTyp=B&billNbr=0209&pn=0175"
      ).href
    ).toBe("https://www.palegis.us/legislation/bills/text/PDF/2021/0/HB0209/PN0175")
  })

  it("normalizes only Ohio's legacy double-slash numeric download route", () => {
    expect(resolveApprovedDocumentUrl("https://www.legislature.ohio.gov//download?key=25019")).toEqual(
      new URL("https://www.legislature.ohio.gov/download?key=25019")
    )
    expect(resolveApprovedDocumentUrl("https://www.legislature.ohio.gov//download?key=25019&format=pdf").href).toBe(
      "https://www.legislature.ohio.gov//download?key=25019&format=pdf"
    )
    expect(resolveApprovedDocumentUrl("https://www.legislature.ohio.gov/download?key=25019").href).toBe(
      "https://www.legislature.ohio.gov/download?key=25019"
    )
  })

  it("does not rewrite Pennsylvania bill-text URLs without every canonical identifier", () => {
    const sourceUrl =
      "https://www.legis.state.pa.us/CFDOCS/Legis/PN/Public/btCheck.cfm?txtType=DOC&sessYr=2021&sessInd=0&billBody=H&billTyp=R&billNbr=0170"

    expect(resolveApprovedDocumentUrl(sourceUrl).href).toBe(sourceUrl)
  })

  it("maps Hawaii's Cloudflare-blocked bill and committee-report archives to the official data host", () => {
    expect(resolveApprovedDocumentUrl("https://www.capitol.hawaii.gov/session2020/bills/HB1405_SD2_.HTM")).toEqual(
      new URL("https://data.capitol.hawaii.gov/sessions/session2020/Bills/HB1405_SD2_.HTM")
    )
    expect(
      resolveApprovedDocumentUrl("https://www.capitol.hawaii.gov/session2020/commreports/GM501_SSCR3593_.PDF")
    ).toEqual(new URL("https://data.capitol.hawaii.gov/sessions/session2020/CommReports/GM501_SSCR3593_.PDF"))
    expect(resolveApprovedDocumentUrl("https://capitol.hawaii.gov/session2021/bills/HB362_.HTM")).toEqual(
      new URL("https://data.capitol.hawaii.gov/sessions/session2021/Bills/HB362_.HTM")
    )
    expect(resolveApprovedDocumentUrl("https://capitol.hawaii.gov/sessions/session2022/bills/HB1532_.PDF")).toEqual(
      new URL("https://data.capitol.hawaii.gov/sessions/session2022/Bills/HB1532_.PDF")
    )
    expect(
      resolveApprovedDocumentUrl(
        "https://capitol.hawaii.gov/Session2021/Testimony/HB310_SD1_TESTIMONY_JDC-WAM_04-06-21_.PDF"
      )
    ).toEqual(
      new URL(
        "https://data.capitol.hawaii.gov/sessions/session2021/Testimony/HB310_SD1_TESTIMONY_JDC-WAM_04-06-21_.PDF"
      )
    )
  })

  it("refuses Hawaii URLs outside the evidenced archive contract", () => {
    const unsupportedUrls = [
      "https://www.capitol.hawaii.gov/session2020/House/HB1405_SD2_.HTM",
      "https://www.capitol.hawaii.gov/session2020/bills/nested/HB1405_SD2_.HTM",
      "https://www.capitol.hawaii.gov/session20/bills/HB1405_SD2_.HTM",
      "https://www.capitol.hawaii.gov/session2020/bills/HB1405_SD2_.HTM?download=1",
      "http://www.capitol.hawaii.gov/session2020/bills/HB1405_SD2_.HTM",
      "https://www.capitol.hawaii.gov/session2020/bills/HB1405_SD2_.EXE"
    ]

    for (const sourceUrl of unsupportedUrls) {
      expect(resolveApprovedDocumentUrl(sourceUrl).href).toBe(sourceUrl)
    }
  })

  it("does not permit arbitrary FTP URLs", () => {
    expect(resolveApprovedDocumentUrl("ftp://example.gov/bill.pdf").protocol).toBe("ftp:")
  })

  it("submits the California bill PDF auto-download form", async () => {
    const form = `
      <html><body><form id="downloadForm" action="/faces/billPdf.xhtml">
        <input name="javax.faces.ViewState" value="view-state" />
      </form></body></html>`
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(form, {
          headers: { "content-type": "text/html; charset=UTF-8", "set-cookie": "session=abc; Path=/" }
        })
      )
      .mockResolvedValueOnce(new Response("%PDF-test", { headers: { "content-type": "application/pdf" }, status: 200 }))

    const result = await downloadDocument(
      "https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=202120220AB819&version=20210AB81994CHP",
      { fetch: fetcher }
    )

    expect(result.contentType).toBe("application/pdf")
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]?.[0]).toEqual(new URL("https://leginfo.legislature.ca.gov/faces/billPdf.xhtml"))
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      body: new URLSearchParams({
        "javax.faces.ViewState": "view-state",
        bill_id: "202120220AB819",
        downloadForm: "downloadForm",
        pdf_link2: "pdf_link2",
        version: "20210AB81994CHP"
      }),
      headers: expect.objectContaining({
        cookie: "session=abc",
        origin: "https://leginfo.legislature.ca.gov",
        referer: "https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=202120220AB819&version=20210AB81994CHP"
      }),
      method: "POST"
    })
  })

  it("rejects a California publisher page returned by the PDF form", async () => {
    const form = `
      <html><body><form id="downloadForm" action="/faces/billPdf.xhtml">
        <input name="javax.faces.ViewState" value="view-state" />
      </form></body></html>`
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(form, { headers: { "content-type": "text/html" } }))
      .mockResolvedValueOnce(
        new Response('<?xml version="1.0"?><html><body>California Legislative Information</body></html>', {
          headers: { "content-type": "application/xml" }
        })
      )

    await expect(
      downloadDocument(
        "https://leginfo.legislature.ca.gov/faces/billPdf.xhtml?bill_id=202120220AB819&version=20210AB81994CHP",
        { fetch: fetcher }
      )
    ).rejects.toThrow("California bill PDF is not available from publisher (received application/xml)")
  })

  it("detects supported content when provider metadata is missing or generic", () => {
    expect(detectDocumentContentType(new TextEncoder().encode("%PDF-1.7"), "application/octet-stream")).toBe(
      "application/pdf"
    )
    expect(detectDocumentContentType(new TextEncoder().encode("%PDF-1.7"), "pdf")).toBe("application/pdf")
    expect(detectDocumentContentType(new TextEncoder().encode("SECTION 1. Text"))).toBe("text/plain")
    expect(detectDocumentContentType(new TextEncoder().encode('<?xml version="1.0"?><bill/>'))).toBe("application/xml")
    expect(detectDocumentContentType(new TextEncoder().encode("GIF89a"), "application/octet-stream")).toBe("image/gif")
    expect(detectDocumentContentType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]), "application/octet-stream")).toBe(
      "image/jpeg"
    )
    expect(detectDocumentContentType(new TextEncoder().encode("{\\rtf1 legal text}"), "text/plain")).toBe(
      "application/rtf"
    )
    const docx = zipSync({
      "[Content_Types].xml": new TextEncoder().encode("<Types/>"),
      "word/document.xml": new TextEncoder().encode("<document/>")
    })
    expect(detectDocumentContentType(docx)).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  })

  it("does not pass an HTML interstitial to the PDF extractor", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("<!doctype html><html><body>Temporarily unavailable</body></html>", {
        headers: { "content-type": "application/pdf" }
      })
    )

    await expect(downloadDocument("https://example.gov/bill.pdf", { fetch: fetcher })).rejects.toThrow(
      "HTML instead of advertised PDF"
    )
  })

  it("recognizes the House committee repository not-found page behind a PDF response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          "<!doctype html><html><head><title>Not Found | Committee Repository | U.S. House of Representatives</title></head></html>",
          { headers: { "content-type": "application/pdf" } }
        )
      )

    await expect(
      downloadDocument("https://www.congress.gov/119/meeting/house/missing.pdf", { fetch: fetcher })
    ).rejects.toThrow("Congress committee repository reports document not found")
  })

  it("retains bounded native network diagnostics without persisting the request URL", async () => {
    const cause = Object.assign(new Error("Connect Timeout Error to https://publisher.example/bill.pdf?token=secret"), {
      code: "UND_ERR_CONNECT_TIMEOUT"
    })
    const failure = new TypeError("fetch failed", { cause })
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure)

    await expect(
      downloadDocument("https://publisher.example/bill.pdf?token=secret", { fetch: fetcher })
    ).rejects.toThrow(
      "Document fetch failed (TypeError: fetch failed; cause: UND_ERR_CONNECT_TIMEOUT: Error: Connect Timeout Error to [url]"
    )
    await expect(
      downloadDocument("https://publisher.example/bill.pdf?token=secret", { fetch: fetcher })
    ).rejects.not.toThrow("token=secret")
  })

  it("uses the authenticated Azure relay only for an approved publisher artifact", async () => {
    vi.stubEnv("DOCUMENT_FETCH_RELAY_URL", "https://legislation.example/internal/document-fetch")
    vi.stubEnv("DOCUMENT_FETCH_RELAY_TOKEN", "relay-secret")
    const sourceUrl =
      "http://www.legis.state.pa.us/CFDOCS/Legis/PN/Public/btCheck.cfm?txtType=PDF&sessYr=2021&sessInd=0&billBody=H&billTyp=B&billNbr=0209&pn=0175"
    const artifactUrl = "https://www.palegis.us/legislation/bills/text/PDF/2021/0/HB0209/PN0175"
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("%PDF-relayed", {
        headers: {
          "content-type": "application/pdf",
          "x-legislation-relayed-source": artifactUrl
        }
      })
    )

    await expect(downloadDocument(sourceUrl)).resolves.toMatchObject({
      contentType: "application/pdf",
      sourceUrl: artifactUrl
    })
    expect(fetcher).toHaveBeenCalledWith(
      "https://legislation.example/internal/document-fetch",
      expect.objectContaining({
        body: JSON.stringify({ sourceUrl: artifactUrl }),
        headers: expect.objectContaining({ authorization: "Bearer relay-secret" }),
        method: "POST"
      })
    )
  })

  it("allows only the proven Pennsylvania House and Senate fiscal-note archive paths through the relay", () => {
    expect(
      isApprovedDocumentRelayUrl(new URL("https://www.legis.state.pa.us/WU01/LI/BI/FN/2021/0/HB0326P0388.pdf"))
    ).toBe(true)
    expect(
      isApprovedDocumentRelayUrl(new URL("https://www.legis.state.pa.us/WU01/LI/BI/SFN/2021/0/HB0326P0388.pdf"))
    ).toBe(true)
    expect(
      isApprovedDocumentRelayUrl(
        new URL("https://www.legis.state.pa.us/WU01/LI/BI/SFN/2021/0/HB0326P0388.pdf?download=1")
      )
    ).toBe(false)
    expect(
      isApprovedDocumentRelayUrl(new URL("https://www.legis.state.pa.us/WU01/LI/BI/OTHER/2021/0/HB0326P0388.pdf"))
    ).toBe(false)
  })

  it("allows only exact official Pennsylvania amendment artifacts through the relay", () => {
    const base = "https://www.palegis.us/legislation/amendments/text/2023/0/A03924"
    expect(isApprovedDocumentRelayUrl(new URL(base))).toBe(true)
    expect(isApprovedDocumentRelayUrl(new URL(`${base}?txtType=HTM`))).toBe(true)
    expect(isApprovedDocumentRelayUrl(new URL(`${base}?txtType=DOC`))).toBe(true)
    expect(isApprovedDocumentRelayUrl(new URL(`${base}?txtType=XML`))).toBe(false)
    expect(isApprovedDocumentRelayUrl(new URL(`${base}?txtType=HTM&download=1`))).toBe(false)
    expect(isApprovedDocumentRelayUrl(new URL(`${base}#section`))).toBe(false)
    expect(isApprovedDocumentRelayUrl(new URL("https://example.com/legislation/amendments/text/2023/0/A03924"))).toBe(
      false
    )
  })

  it("lets the Azure relay transport an unsupported artifact before worker classification", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), {
        headers: { "content-type": "application/msword" }
      })
    )

    await expect(
      downloadDocument("https://www.palegis.us/legislation/bills/text/DOC/2021/0/HB1013/PN1052", {
        detectContentType: false,
        fetch: fetcher
      })
    ).resolves.toMatchObject({ contentType: "application/msword" })
  })

  it("stops a missing-length response once it crosses the document size limit", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(8))
        controller.enqueue(new Uint8Array(8))
        controller.close()
      }
    })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(body, { headers: { "content-type": "application/pdf" } }))

    await expect(
      downloadDocument("https://example.gov/oversized.pdf", { fetch: fetcher, maximumBytes: 12 })
    ).rejects.toThrow("Document exceeds the 12 byte limit")
  })

  it("rejects unknown binary content after bounded sniffing", () => {
    expect(() => detectDocumentContentType(new Uint8Array([0, 1, 2, 3]), "application/octet-stream")).toThrow(
      "Unsupported document content type"
    )
  })
})
