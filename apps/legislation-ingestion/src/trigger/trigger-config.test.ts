import { describe, expect, it } from "vitest"
import config from "../../trigger.config.js"

describe("Trigger deployment configuration", () => {
  it("installs PDF.js for dynamically loaded PDF extraction", () => {
    expect(config.build?.external).toContain("pdfjs-dist")
  })
  it("retains the tokenizer package with its WebAssembly runtime asset", () => {
    expect(config.build?.external).toContain("tiktoken")
  })
  it("packages the Python adapter without enabling an unverified scraper dependency installation", () => {
    expect(config.build?.extensions?.map((extension) => extension.name)).toContain("PythonExtension")
  })
})
