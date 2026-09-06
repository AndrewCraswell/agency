import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

/** Restore reading order from source coordinates rather than PDF content-stream order. */
export async function extractGovInfoCommitteePdfText(bytes: Uint8Array): Promise<string> {
  const task = getDocument({ data: bytes, useSystemFonts: true })
  const document = await task.promise
  try {
    if (document.numPages > 2000) {
      throw new Error("GovInfo directory exceeds the PDF page safety bound")
    }
    const pages: string[] = []
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const items = content.items
        .filter((item) => "str" in item && item.str.trim())
        .map((item) => {
          if (!("str" in item)) {
            throw new Error("Unexpected PDF marked content")
          }
          return {
            text: item.str,
            x: item.transform[4] ?? 0,
            y: item.transform[5] ?? 0,
            width: item.width,
            height: item.height
          }
        })
        .sort((a, b) => (Math.abs(a.y - b.y) > 2 ? b.y - a.y : a.x - b.x))
      const rows: { y: number; height: number; text: string; right: number }[] = []
      const leftMargin = Math.min(...items.map((item) => item.x))
      const pageMiddle = (page.view[2] ?? 612) / 2
      const columnStarts = new Map<number, number>()
      for (const item of items) {
        if (item.x >= pageMiddle - 16 && item.x < pageMiddle + 48 && /^[A-Z]/.test(item.text)) {
          const position = Math.round(item.x)
          columnStarts.set(position, (columnStarts.get(position) ?? 0) + 1)
        }
      }
      const rightColumnStart = [...columnStarts].sort((left, right) => right[1] - left[1])[0]?.[0]
      for (const item of items) {
        let row = rows.at(-1)
        if (!row || Math.abs(row.y - item.y) > 2) {
          row = {
            y: item.y,
            height: item.height,
            text: " ".repeat(Math.max(0, Math.round((item.x - leftMargin) / 5))),
            right: item.x
          }
          rows.push(row)
        }
        const gap = item.x - row.right
        let spaces = 0
        if (row.text && gap > 1) {
          spaces = gap > 15 ? 4 : 1
        }
        if (
          row.text.includes(", of ") &&
          /^[A-Z]/.test(item.text) &&
          rightColumnStart !== undefined &&
          row.right < rightColumnStart + 1 &&
          Math.abs(item.x - rightColumnStart) <= 1
        ) {
          spaces = 4
        }
        row.text += `${" ".repeat(spaces)}${item.text}`
        row.right = item.x + item.width
      }
      let previousY: number | undefined
      let previousHeight: number | undefined
      pages.push(
        rows
          .map((row) => {
            const distance = previousY === undefined ? 0 : previousY - row.y
            const isWrappedHeading =
              previousHeight !== undefined &&
              previousHeight > 9 &&
              row.height > 9 &&
              Math.abs(previousHeight - row.height) < 1 &&
              distance <= previousHeight * 1.5
            const blank = distance > 12 && !isWrappedHeading ? "\n" : ""
            previousY = row.y
            previousHeight = row.height
            return blank + row.text
          })
          .filter((line) => !/VerDate|with \$\$_JOB|LOCATORS/.test(line) && !/^\s*\d+\s*$/.test(line))
          .filter(
            (line) =>
              !/^\s*(?:\d+\s+)?(?:Congressional Directory|Committees of the (?:Senate|House))(?:\s+\d+)?\s*$/.test(line)
          )
          .join("\n")
      )
      page.cleanup()
    }
    return pages.join("\n\n")
  } finally {
    await task.destroy()
  }
}
