import { describe, expect, it } from "vitest"
import config from "../../trigger.config.js"

describe("Trigger deployment configuration", () => {
  it("installs PDF.js for dynamically loaded PDF extraction", () => {
    expect(config.build?.external).toContain("pdfjs-dist")
  })
})
