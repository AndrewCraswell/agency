import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { useRef, useState } from "react"
import { expect, fn, waitFor, within } from "storybook/test"
import type { StagedReference } from "../chatRequest"
import { ChatComposer } from "../components/ChatComposer"
import { textDraft, type ComposerDraft } from "../composerDraft"
import * as styles from "./MentionComposerExample.css"

function reference(
  id: string,
  title: string,
  subtitle: string,
  kind: "person" | "organization" = "person"
): StagedReference {
  return {
    resultId: "23974c17-3898-4b92-96f7-1c600704e12e",
    recordId: id,
    record: {
      id,
      kind,
      title,
      subtitle,
      fields: [],
      tallies: [],
      sourceUrl: null,
      ...(kind === "organization" ? { organizationSummary: { classification: "committee" } } : {})
    }
  }
}
const person = reference("design:whitfield", "Rep. Dana Whitfield", "Colorado House, District 18, Democrat")
const senator = reference("design:whitaker", "Sen. Marcus Whitaker", "Colorado Senate, District 7, Republican")
const committee = reference("design:housing", "House Local Government and Housing", "Colorado House", "organization")
const mixed = [person, senator, committee]
const sameName = reference(
  "design:whitfield-other",
  person.record.title,
  "New Mexico House, District 24, former member"
)
const longName = reference(
  "design:long",
  "Subcommittee on Transportation, Housing and Urban Development, and Related Agencies",
  "U.S. House, Committee on Appropriations",
  "organization"
)
const selected = Array.from({ length: 12 }, (_, index) =>
  reference(`design:selected-${index}`, `Member ${index + 1}`, "Published person record")
)
const search = fn()
const submitted = fn()

function SuggestionsExample({
  initialDraft,
  state = "ready",
  results = mixed,
  selectionCount = 0
}: Readonly<{
  initialDraft: string
  state?: "ready" | "loading" | "failed" | "retry"
  results?: StagedReference[]
  selectionCount?: number
}>) {
  const [draft, setDraft] = useState<ComposerDraft>(() => [
    ...selected
      .slice(0, selectionCount)
      .flatMap((item): ComposerDraft => [{ type: "mention", reference: item }, ...textDraft(" ")]),
    ...textDraft(initialDraft)
  ])
  const attempts = useRef(0)
  return (
    <div className={styles.stage}>
      <div className={styles.workspace}>
        <ChatComposer
          focusOnMount
          draft={draft}
          onDraftChange={setDraft}
          onSend={() => {
            submitted(draft)
            setDraft([])
          }}
          searchMentions={async (query, signal) => {
            search(query)
            signal.throwIfAborted()
            attempts.current += 1
            if (state === "loading") {
              return new Promise((_resolve, reject) =>
                signal.addEventListener("abort", () => reject(signal.reason), { once: true })
              )
            }
            if (state === "failed" || (state === "retry" && attempts.current === 1)) {
              throw new Error("Simulated mention search failure")
            }
            return results
          }}
        />
      </div>
    </div>
  )
}

const meta = {
  title: "Conversation/Mention suggestions",
  component: SuggestionsExample,
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: {
        mentionMobile: { name: "Mentions 320px", styles: { width: "320px", height: "740px" } },
        mentionPhone: { name: "Mentions 390px", styles: { width: "390px", height: "844px" } }
      }
    }
  },
  beforeEach: () => {
    search.mockClear()
    submitted.mockClear()
  }
} satisfies Meta<typeof SuggestionsExample>
export default meta
type Story = StoryObj<typeof meta>

export const Initial: Story = {
  args: { initialDraft: "@" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(await canvas.findByText("Keep typing to narrow the list")).toBeVisible()
    await expect(canvas.getByRole("listbox", { name: "People and committees" })).toHaveAttribute("aria-busy", "false")
    await expect(search).not.toHaveBeenCalled()
  }
}
export const OneCharacter: Story = { ...Initial, args: { initialDraft: "@w" } }
export const Loading: Story = {
  args: { initialDraft: "What has @whit", state: "loading" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(await canvas.findByText("Searching people and committees...")).toBeVisible()
    await expect(canvas.getByRole("listbox", { name: "People and committees" })).toHaveAttribute("aria-busy", "true")
    await expect(canvasElement.ownerDocument.querySelector("[data-mention-skeletons]")?.children).toHaveLength(3)
  }
}
export const LoadingNarrow: Story = {
  ...Loading,
  globals: { viewport: { value: "mentionMobile", isRotated: false } }
}

const ready: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  const canvas = within(canvasElement.ownerDocument.body)
  await canvas.findAllByRole("option", undefined, { timeout: 5000 })
  const popup = canvas.getByRole("region", { name: "People and committees" })
  await waitFor(() =>
    expect(popup.getBoundingClientRect().width).toBe(
      Math.min(420, canvasElement.ownerDocument.documentElement.clientWidth - 32)
    )
  )
  await waitFor(() => {
    const bounds = popup.getBoundingClientRect()
    expect(bounds.left).toBeGreaterThanOrEqual(16)
    expect(bounds.right).toBeLessThanOrEqual(canvasElement.ownerDocument.documentElement.clientWidth - 16)
  })
  await expect(canvas.getByRole("listbox")).toHaveAttribute("aria-busy", "false")
  const list = canvas.getByRole("listbox")
  await expect(list).toHaveStyle({ paddingTop: "0px", paddingBottom: "0px" })
  await expect(list.querySelector("legend")).toHaveStyle({ paddingTop: "12px" })
  list.scrollTop = list.scrollHeight
  const last = canvas.getAllByRole("option").at(-1)
  await expect(
    Math.abs(list.getBoundingClientRect().bottom - (last?.getBoundingClientRect().bottom ?? 0))
  ).toBeLessThan(1)
  list.scrollTop = 0
}
export const MixedResults: Story = {
  args: { initialDraft: "How did @whit" },
  play: async (context) => {
    await ready(context)
    await within(context.canvasElement.ownerDocument.body).findByRole("option", { name: /Rep. Dana Whitfield/ })
    const canvas = within(context.canvasElement.ownerDocument.body)
    await expect(canvas.getAllByRole("option")).toHaveLength(3)
    await expect(canvas.getByRole("group", { name: "People" })).toBeVisible()
    await expect(canvas.getByRole("group", { name: "Committees" })).toBeVisible()
  }
}
export const PeopleOnly: Story = { args: { initialDraft: "Ask @whit", results: [person, senator] } }
export const CommitteesOnly: Story = { args: { initialDraft: "Ask @housing", results: [committee] }, play: ready }
export const SingleResult: Story = { args: { initialDraft: "Ask @whitfield", results: [person] }, play: ready }
export const AmbiguousNames: Story = {
  args: { initialDraft: "Ask @whitfield", results: [person, sameName] },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(await canvas.findByRole("option", { name: /New Mexico/ }))
    await expect(canvas.getByRole("textbox").querySelector('[data-type="mention"]')).toHaveAttribute(
      "data-id",
      sameName.recordId
    )
  }
}
export const LongCommitteeName: Story = {
  args: { initialDraft: "Ask @transportation", results: [longName] },
  play: ready
}
export const MissingMetadata: Story = {
  args: { initialDraft: "Ask @whitfield", results: [{ ...person, record: { ...person.record, subtitle: undefined } }] }
}
export const ManyResults: Story = {
  args: {
    initialDraft: "Ask @member",
    results: [
      ...Array.from({ length: 5 }, (_, index) =>
        reference(`design:member-${index}`, `Member ${index + 1}`, "Colorado House, published person record")
      ),
      ...Array.from({ length: 5 }, (_, index) =>
        reference(`design:committee-${index}`, `Committee ${index + 1}`, "Colorado House", "organization")
      )
    ]
  }
}
export const NoMatches: Story = {
  args: { initialDraft: "Find @zzzz", results: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(await canvas.findByText("No matching people or committees.")).toBeVisible()
    await expect(canvas.queryByRole("option")).not.toBeInTheDocument()
  }
}
export const SearchFailed: Story = {
  args: { initialDraft: "Ask @whit", state: "failed" },
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement.ownerDocument.body).findByRole("alert")).toHaveTextContent(
      "People and committees could not be loaded."
    )
  }
}
export const RetrySucceeds: Story = {
  args: { initialDraft: "Ask @whit", state: "retry" },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await userEvent.click(await canvas.findByRole("button", { name: "Try again" }, { timeout: 5000 }))
    await expect(await canvas.findByRole("option", { name: /Rep. Dana Whitfield/ })).toBeVisible()
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument()
  }
}
export const KeyboardSelection: Story = {
  args: { initialDraft: "Ask @whit" },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await canvas.findByRole("option", { name: /Rep. Dana Whitfield/ })
    canvas.getByRole("textbox").focus()
    await userEvent.keyboard("{ArrowDown}")
    await waitFor(() =>
      expect(canvas.getByRole("option", { name: /Marcus Whitaker/ })).toHaveAttribute("aria-selected", "true")
    )
    await userEvent.keyboard("{Enter}")
    await expect(canvas.getByRole("textbox").querySelector('[data-type="mention"]')).toHaveAttribute(
      "data-id",
      senator.recordId
    )
    await expect(canvas.getByRole("textbox")).toHaveFocus()
    await expect(submitted).not.toHaveBeenCalled()
  }
}
export const EscapeDismissal: Story = {
  args: { initialDraft: "Ask @whit" },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await canvas.findByRole("option", { name: /Rep. Dana Whitfield/ }, { timeout: 5000 })
    canvas.getByRole("textbox").focus()
    await userEvent.keyboard("{Escape}")
    await expect(canvas.queryByRole("listbox")).not.toBeInTheDocument()
    await expect(canvas.getByRole("textbox")).toHaveTextContent("Ask @whit")
  }
}
export const LoadingCannotSelect: Story = {
  ...Loading,
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await canvas.findByText("Searching people and committees...")
    canvas.getByRole("textbox").focus()
    await userEvent.keyboard("{ArrowDown}{Enter}")
    await expect(canvas.getByRole("textbox")).toHaveTextContent("What has @whit")
    await expect(submitted).not.toHaveBeenCalled()
  }
}
export const ReferenceLimit: Story = {
  args: { initialDraft: "Ask @whit", selectionCount: 12 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    const option = await canvas.findByRole("option", { name: /Rep. Dana Whitfield/ })
    await expect(option).toHaveAttribute("aria-disabled", "true")
    await expect(canvas.getByText("You can add up to 12 references.")).toBeVisible()
  }
}
export const ExistingReferenceAtLimit: Story = {
  args: { initialDraft: "Ask @member", selectionCount: 12, results: selected.slice(0, 1) },
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement.ownerDocument.body).findByRole("option", undefined, { timeout: 5000 })
    ).toHaveAttribute("aria-disabled", "false")
  }
}
export const MobileResults: Story = { ...MixedResults, globals: LoadingNarrow.globals }
export const MobileLongName: Story = { ...LongCommitteeName, globals: LoadingNarrow.globals }
export const MobileInitial: Story = { ...Initial, globals: LoadingNarrow.globals }
export const MobileFailed: Story = { ...SearchFailed, globals: LoadingNarrow.globals }
export const PhoneResults: Story = {
  ...MixedResults,
  globals: { viewport: { value: "mentionPhone", isRotated: false } }
}
