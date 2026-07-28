import { describe, expect, it } from "vitest"
import { diffVersions } from "./version-diff"

describe("diffVersions", () => {
  const before = {
    title: "Wet-weather camping",
    excerpt: "Prepare a campsite for rain.",
    tags: ["camping", "rain"],
    bodyText: "Choose raised ground.",
    author: "Dana Reed",
    handle: "wet-weather-camping",
    seoTitle: "",
    seoDescription: ""
  }

  it("marks the working copy text as removed and the older text as added", () => {
    const [title] = diffVersions(before, { ...before, title: "Dry-weather camping" })

    expect(title.field).toBe("Title")
    expect(title.hasChanges).toBe(true)
    expect(
      title.parts
        .filter((part) => part.change === "removed")
        .map((part) => part.value)
        .join("")
    ).toContain("Wet")
    expect(
      title.parts
        .filter((part) => part.change === "added")
        .map((part) => part.value)
        .join("")
    ).toContain("Dry")
  })

  it("reports every field and flags only the ones that differ", () => {
    const fields = diffVersions(before, { ...before, tags: ["camping"] })

    expect(fields.map((field) => field.field)).toEqual([
      "Title",
      "Excerpt",
      "Tags",
      "Content",
      "Author",
      "URL handle",
      "Search engine title",
      "Search engine description"
    ])
    expect(fields.filter((field) => field.hasChanges).map((field) => field.field)).toEqual(["Tags"])
  })

  it("reports no changes when the versions match", () => {
    expect(diffVersions(before, { ...before }).some((field) => field.hasChanges)).toBe(false)
  })
})
