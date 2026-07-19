import { WorkflowTopologySchema } from "./contracts"

export const deliveryWorkflowTopology = WorkflowTopologySchema.parse({
  graphVersion: "delivery-v1",
  name: "Autonomous delivery",
  nodes: [
    {
      id: "planning",
      label: "Plan",
      description: "Select and shape one bounded work item.",
      agentId: "scrum-master",
      agentName: "Scrum master",
      stages: ["intake", "planning"]
    },
    {
      id: "implementation",
      label: "Implement",
      description: "Build and independently validate the assigned change.",
      agentId: "engineer",
      agentName: "Engineer",
      stages: ["coding", "publishing"]
    },
    {
      id: "review",
      label: "Review",
      description: "Review the exact candidate commit in a fresh workspace.",
      agentId: "reviewer",
      agentName: "Reviewer",
      stages: ["reviewing"]
    },
    {
      id: "repair",
      label: "Repair",
      description: "Address accepted findings in the retained engineer workspace.",
      agentId: "engineer",
      agentName: "Engineer",
      stages: ["repairing"]
    },
    {
      id: "decision",
      label: "Finish",
      description: "Merge an approved candidate or block an unresolved delivery.",
      agentId: null,
      agentName: null,
      stages: ["completed"]
    }
  ],
  edges: [
    { source: "planning", target: "implementation", label: "Assignment ready", kind: "forward" },
    { source: "implementation", target: "review", label: "Draft pull request", kind: "forward" },
    { source: "review", target: "decision", label: "Approved or final", kind: "forward" },
    { source: "review", target: "repair", label: "Changes requested", kind: "loop" },
    { source: "repair", target: "review", label: "Re-review", kind: "loop" }
  ]
})
