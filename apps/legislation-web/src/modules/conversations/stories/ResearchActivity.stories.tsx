import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import type { ComponentProps } from "react"
import { expect, within } from "storybook/test"
import invariant from "tiny-invariant"
import { ResearchActivity } from "../components/ResearchActivity"
import type { ResearchFailureCode } from "../researchFailure"
import { researchToolLabels } from "../researchTools"
import { activityPart, activityStates, capturedCards, failureCodes, toolCaptures } from "./reviewFixtures"
import * as styles from "./ReviewGallery.css"

type ActivityArgs = {
  toolName: string
  failureCode: ResearchFailureCode
}

const meta = {
  title: "Conversation/ResearchActivity",
  parameters: { layout: "padded" },
  args: { toolName: "search_bills", failureCode: "dependency_unavailable" },
  argTypes: {
    toolName: { control: false },
    failureCode: { control: "select", options: failureCodes }
  },
  render: ({ toolName, failureCode }) => {
    const capture = toolCaptures.find((candidate) => candidate.toolName === toolName)
    invariant(capture, `Missing capture for ${toolName}`)
    const previousParts = toolCaptures
      .slice(0, toolCaptures.indexOf(capture))
      .map((previous) => activityPart(previous, "Complete").part)
    if (toolName === "get_supporting_material") {
      previousParts.push({ ...activityPart(capture, "Complete").part, toolCallId: "previous-material-read" })
    }
    return (
      <section aria-label={`${researchToolLabels[toolName]} states`}>
        <h2 className={styles.groupHeading}>{researchToolLabels[toolName]}</h2>
        <div className={styles.grid}>
          {(toolName === "search_events" || toolName === "search_changes") && (
            <section className={styles.sample} aria-label="With filters">
              <ResearchActivity
                isRunning
                part={{
                  type: "dynamic-tool",
                  toolCallId: "simulated-filtered-search",
                  toolName,
                  state: "input-available",
                  input:
                    toolName === "search_events"
                      ? { jurisdictionId: "jurisdiction:us", from: "2026-09-01T00:00:00Z", to: "2026-09-16T23:59:59Z" }
                      : {
                          recordId: "bill:ca:20232024:ab:2652",
                          recordType: "bill",
                          classification: "update",
                          observedFrom: "2026-09-01T00:00:00Z"
                        }
                }}
              />
            </section>
          )}
          {activityStates.map((state) => (
            <section key={state} className={styles.sample} aria-label={state} data-review-state={state}>
              <h3 className={styles.label}>{state}</h3>
              <ResearchActivity {...activityPart(capture, state, failureCode)} previousParts={previousParts} />
            </section>
          ))}
          <section className={styles.sample} aria-label="Failed expanded" data-review-state="Failed expanded">
            <h3 className={styles.label}>Failed expanded</h3>
            <ResearchActivity {...activityPart(capture, "Failed", failureCode)} previousParts={previousParts} />
          </section>
          <section className={styles.sample} aria-label="Denied expanded" data-review-state="Denied expanded">
            <h3 className={styles.label}>Denied expanded</h3>
            <ResearchActivity {...activityPart(capture, "Denied")} previousParts={previousParts} />
          </section>
        </div>
        {toolName === "get_supporting_material" && (
          <div className={styles.grid}>
            {capturedCards
              .filter(({ record }) => record.kind === "material")
              .map(({ record }) => (
                <section
                  key={record.id}
                  className={styles.sample}
                  aria-label={record.title}
                  data-review-material={record.id}
                >
                  <ResearchActivity
                    isRunning
                    previousParts={[
                      {
                        type: "dynamic-tool",
                        toolCallId: `previous-${record.id}`,
                        toolName: "get_supporting_material",
                        state: "output-available",
                        input: { id: record.id },
                        output: { resultSet: { items: [record] } }
                      }
                    ]}
                    part={{
                      type: "dynamic-tool",
                      toolCallId: `read-${record.id}`,
                      toolName: "get_supporting_material",
                      state: "input-available",
                      input: { id: record.id }
                    }}
                  />
                </section>
              ))}
          </div>
        )}
      </section>
    )
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    for (const state of activityStates) {
      await expect(canvas.getByRole("region", { name: state })).toBeVisible()
    }
    const collapsed = within(canvas.getByRole("region", { name: "Failed" }))
    await expect(collapsed.getByRole("button")).toHaveAttribute("aria-expanded", "false")
    const expanded = within(canvas.getByRole("region", { name: "Failed expanded" }))
    const trigger = expanded.getByRole("button")
    if (trigger.getAttribute("aria-expanded") !== "true") {
      await userEvent.click(trigger)
    }
    await expect(trigger).toHaveAttribute("aria-expanded", "true")
    await expect(expanded.getByText("Failed")).toBeVisible()
    const denied = within(canvas.getByRole("region", { name: "Denied expanded" }))
    const denialTrigger = denied.getByRole("button")
    if (denialTrigger.getAttribute("aria-expanded") !== "true") {
      await userEvent.click(denialTrigger)
    }
    await expect(denied.getByText("This operation was not permitted.")).toBeVisible()
    await expect(denied.getByText("Denied", { selector: "span" })).toBeVisible()
  }
} satisfies Meta<ActivityArgs>
export default meta
type Story = StoryObj<typeof meta>

export const SearchBills: Story = { args: { toolName: "search_bills" } }
export const ReadBill: Story = { args: { toolName: "get_bill" } }
export const ReadBills: Story = { args: { toolName: "get_bills" } }
export const ReadBillTimeline: Story = { args: { toolName: "get_bill_timeline" } }
export const SearchBillText: Story = { args: { toolName: "search_bill_text" } }
export const ReadBillText: Story = { args: { toolName: "get_bill_text" } }
export const CompareBillVersions: Story = { args: { toolName: "compare_bill_versions" } }
export const FindRelatedBills: Story = { args: { toolName: "find_related_bills" } }
export const SearchPeople: Story = { args: { toolName: "search_people" } }
export const ReadPerson: Story = { args: { toolName: "get_person" } }
export const SearchOrganizations: Story = { args: { toolName: "search_organizations" } }
export const ReadOrganization: Story = { args: { toolName: "get_organization" } }
export const SearchMeetings: Story = { args: { toolName: "search_events" } }
export const ReadMeeting: Story = { args: { toolName: "get_event" } }
export const SearchVotes: Story = { args: { toolName: "search_votes" } }
export const ReadBillVotes: Story = { args: { toolName: "get_bill_votes" } }
export const ReadVote: Story = { args: { toolName: "get_vote" } }
export const ReadVotes: Story = { args: { toolName: "get_votes" } }
export const SearchAmendments: Story = { args: { toolName: "search_amendments" } }
export const ReadAmendment: Story = { args: { toolName: "get_amendment" } }
export const ReadAmendments: Story = { args: { toolName: "get_amendments" } }
export const FindAmendmentsForBills: Story = { args: { toolName: "search_amendments_for_bills" } }
export const SearchSupportingMaterials: Story = { args: { toolName: "search_supporting_materials" } }
export const ReadSupportingMaterial: Story = { args: { toolName: "get_supporting_material" } }
export const SearchRecordedChanges: Story = { args: { toolName: "search_changes" } }

type ActivityExample = { name: string; props: ComponentProps<typeof ResearchActivity> }
const comparisonInput = {
  billId: "bill:ca:20232024:ab:2652",
  documentIds: ["simulation-document-first", "simulation-document-second"]
}
const comparisonDocuments = [
  {
    id: comparisonInput.documentIds[0],
    billId: comparisonInput.billId,
    versionCode: "Amended",
    documentDate: "2024-04-08"
  },
  {
    id: comparisonInput.documentIds[1],
    billId: comparisonInput.billId,
    versionCode: "Amended",
    documentDate: "2024-04-18"
  }
]
const comparisonBase = {
  type: "dynamic-tool",
  toolCallId: "simulation-comparison",
  toolName: "compare_bill_versions",
  input: comparisonInput
} as const
const versionExamples: ActivityExample[] = [
  {
    name: "Identical labels with different dates",
    props: {
      isRunning: false,
      part: {
        ...comparisonBase,
        state: "output-available",
        output: { data: { billId: comparisonInput.billId, documents: comparisonDocuments } }
      }
    }
  },
  {
    name: "One missing version label",
    props: {
      isRunning: true,
      part: { ...comparisonBase, state: "input-available" },
      previousParts: [
        {
          ...comparisonBase,
          toolCallId: "simulation-prior-read",
          toolName: "get_bill",
          state: "output-available",
          output: { data: { documents: [comparisonDocuments[0]] } }
        }
      ]
    }
  },
  {
    name: "Before metadata arrives",
    props: { isRunning: true, part: { ...comparisonBase, state: "input-available" } }
  },
  {
    name: "After metadata arrives",
    props: {
      isRunning: true,
      part: { ...comparisonBase, state: "input-available" },
      previousParts: [
        {
          ...comparisonBase,
          toolCallId: "simulation-prior-read",
          toolName: "get_bill",
          state: "output-available",
          output: { data: { documents: comparisonDocuments } }
        }
      ]
    }
  }
]
const maximumBillIds = Array.from({ length: 25 }, (_, index) => `bill:ca:20232024:ab:${9000 + index}`)
const batchExamples: ActivityExample[] = [
  {
    name: "One requested bill",
    props: {
      isRunning: true,
      part: {
        type: "dynamic-tool",
        toolCallId: "simulation-single",
        toolName: "get_bills",
        state: "input-available",
        input: { ids: [comparisonInput.billId] }
      }
    }
  },
  {
    name: "Maximum batch (25 bills)",
    props: {
      isRunning: true,
      part: {
        type: "dynamic-tool",
        toolCallId: "simulation-maximum",
        toolName: "get_bills",
        state: "input-available",
        input: { ids: maximumBillIds }
      }
    }
  },
  {
    name: "Long labels",
    props: {
      isRunning: true,
      part: {
        type: "dynamic-tool",
        toolCallId: "simulation-long",
        toolName: "get_bills",
        state: "input-available",
        input: {
          ids: [
            "bill:ca:20232024-special-extraordinary-session:acajr:123456",
            "bill:ny:2025-special-legislative-session:sjres:987654"
          ]
        }
      }
    }
  },
  {
    name: "Partial results (1 of 3 requested bills)",
    props: {
      isRunning: false,
      part: {
        type: "dynamic-tool",
        toolCallId: "simulation-partial",
        toolName: "get_bills",
        state: "output-available",
        input: { ids: maximumBillIds.slice(0, 3) },
        output: { data: { items: [{ id: maximumBillIds[0] }] } }
      }
    }
  }
]

function ActivityExamples({ examples }: { examples: ActivityExample[] }) {
  return (
    <div className={styles.grid}>
      {examples.map(({ name, props }) => (
        <section key={name} className={styles.sample} aria-label={name}>
          <ResearchActivity {...props} />
        </section>
      ))}
    </div>
  )
}

export const VersionComparisons: Story = {
  render: () => <ActivityExamples examples={versionExamples} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const example of versionExamples) {
      await expect(canvas.getByRole("region", { name: example.name })).toBeVisible()
    }
    const before = within(canvas.getByRole("region", { name: "Before metadata arrives" }))
    await expect(before.getByText("Version 1 (label unavailable) vs. Version 2 (label unavailable)")).toBeVisible()
    const after = within(canvas.getByRole("region", { name: "After metadata arrives" }))
    await expect(after.getByText("Amended (2024-04-08) vs. Amended (2024-04-18)")).toBeVisible()
    const missing = within(canvas.getByRole("region", { name: "One missing version label" }))
    await expect(missing.getByText("Amended vs. Version 2 (label unavailable)")).toBeVisible()
  }
}

export const BatchReads: Story = {
  render: () => <ActivityExamples examples={batchExamples} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    for (const example of batchExamples) {
      await expect(canvas.getByRole("region", { name: example.name })).toBeVisible()
    }
    const maximum = within(canvas.getByRole("region", { name: "Maximum batch (25 bills)" }))
    await expect(maximum.getByText(/AB 9000, CA, 2023-2024.*AB 9024, CA, 2023-2024/)).toBeVisible()
    const partial = within(canvas.getByRole("region", { name: "Partial results (1 of 3 requested bills)" }))
    await expect(partial.getByText("1 returned")).toBeVisible()
    await expect(partial.getByText(/AB 9000.*AB 9001.*AB 9002/)).toBeVisible()
  }
}

export const FailureMessages: Story = {
  render: () => {
    const capture = toolCaptures.find((candidate) => candidate.toolName === "search_bills")
    invariant(capture, "Missing search bills capture")
    return (
      <div className={styles.grid}>
        {failureCodes.map((code) => (
          <section key={code} className={styles.sample} aria-label={code}>
            <h3 className={styles.label}>{code}</h3>
            <ResearchActivity {...activityPart(capture, "Failed", code)} />
          </section>
        ))}
      </div>
    )
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    for (const code of failureCodes) {
      const region = within(canvas.getByRole("region", { name: code }))
      const trigger = region.getByRole("button")
      if (trigger.getAttribute("aria-expanded") !== "true") {
        await userEvent.click(trigger)
      }
      await expect(trigger).toHaveAttribute("aria-expanded", "true")
      await expect(region.getByText("Failed")).toBeVisible()
    }
  }
}
