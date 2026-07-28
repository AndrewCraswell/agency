import { escapeHtml } from "../liquid.ts"
import type { Template } from "../types.ts"

/** The notification sources all link this absolute path, which only Shopify's own host serves. */
const STYLESHEET_LINK = /<link[^>]*assets\/notifications\/styles\.css[^>]*>/gi

/**
 * Order Printer supplies the surrounding document at print time, so a printout fragment gets a
 * sheet of paper here instead.
 */
export function wrapPrintout(template: Template, rendered: string): string {
  if (rendered.includes("<html")) {
    return rendered
  }
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(template.name)}</title>
    <style>
      /* The host decides the surface behind the paper, so the sheet only brings the paper. */
      html, body { background: transparent; margin: 0; }
      .sheet-preview {
        background: #ffffff;
        box-sizing: border-box;
        margin: 0 auto;
        padding: 0.5in 0.6in;
        width: 8.5in;
      }
      @media print {
        .sheet-preview { padding: 0; width: auto; }
      }
    </style>
  </head>
  <body>
    <div class="sheet-preview">${rendered}</div>
  </body>
</html>`
}

/**
 * Swaps the notification stylesheet link for the real rules. Needed wherever the document is
 * handed to the browser as markup rather than served from a URL, such as a Storybook frame.
 */
export function inlineNotificationStyles(html: string, css: string): string {
  return html.replace(STYLESHEET_LINK, `<style>${css}</style>`)
}
