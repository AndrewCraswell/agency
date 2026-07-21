import {
  Badge,
  Body1,
  Button,
  Caption1,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Dropdown,
  Field,
  Input,
  Link,
  Option,
  Spinner,
  Textarea,
  Title3
} from "@fluentui/react-components"
import { ChevronRightRegular, DeleteRegular } from "@fluentui/react-icons"
import { type Edge, type Node } from "@xyflow/react"
import { useEffect, useState, type ReactNode, type RefObject } from "react"
import {
  discoverRepositoryAgents,
  generateWorkflowSchema,
  getIntegrationResourceInventory,
  listIntegrationProviderEvents,
  listProviderOperations,
  listWorkflowModels,
  parseRepositoryAgentReference,
  type IntegrationResourceInventory,
  type IntegrationProviderEvent,
  type JsonValue,
  type ProviderOperation,
  type RepositoryAgentReference,
  type WorkflowDraftContent,
  type WorkflowDraftView,
  type WorkflowModelSnapshot,
  type WorkflowStep,
  type WorkflowStepDefinition
} from "@/services/api"
import { ConnectionMappingsField } from "./workflowEditor/ConnectionMappingsField"
import { DraftJsonField } from "./workflowEditor/DraftJsonField"
import { supportedJsonSchemaError } from "./workflowEditor/generateJsonSchema"
import { ObjectRowsField } from "./workflowEditor/ObjectRowsField"
import { SwitchCasesField } from "./workflowEditor/SwitchCasesField"
import { WorkflowTestInputEditor } from "./workflowEditor/WorkflowTestInputEditor"
import { useWorkflowEditorInspectorStyles } from "./WorkflowEditorInspector.styles"

type CanvasNode = Node<{ step: WorkflowStep; definition: WorkflowStepDefinition }, "workflow">
type WorkflowConnection = WorkflowDraftContent["connections"][number]
type CanvasEdge = Edge<Pick<WorkflowConnection, "mappings" | "branchKey" | "loopBack">>
type ResourceBinding = WorkflowDraftContent["resourceBindings"][string]
type ProviderChangeStep = (step: WorkflowStep, resourceBinding?: ResourceBinding | null) => void

type WorkflowEditorInspectorProps = {
  open: boolean
  inspectorRef: RefObject<HTMLElement | null>
  draft: WorkflowDraftView
  testInput: string
  setTestInput: (value: string) => void
  showTestInputValidation: boolean
  testTriggers: Array<{ id: string; label: string; kind: string }>
  testTriggerId: string | undefined
  setTestTriggerId: (stepId: string) => void
  selectedNode: CanvasNode | undefined
  selectedEdge: CanvasEdge | undefined
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  repository: WorkflowDraftContent["resourceBindings"][string] | undefined
  changeStep: (step: WorkflowStep, resourceBinding?: WorkflowDraftContent["resourceBindings"][string] | null) => void
  changeEdge: (edge: CanvasEdge) => void
  removeSelectedStep: () => void
  removeSelectedEdge: () => void
  close: () => void
}

export function WorkflowEditorInspector({
  open,
  inspectorRef,
  draft,
  testInput,
  setTestInput,
  showTestInputValidation,
  testTriggers,
  testTriggerId,
  setTestTriggerId,
  selectedNode,
  selectedEdge,
  nodes,
  edges,
  repository,
  changeStep,
  changeEdge,
  removeSelectedStep,
  removeSelectedEdge,
  close
}: WorkflowEditorInspectorProps) {
  const styles = useWorkflowEditorInspectorStyles()

  if (!open) {
    return null
  }

  let detailsTitle = "Workflow details"
  if (selectedEdge !== undefined) {
    detailsTitle = "Connection details"
  }
  if (selectedNode !== undefined) {
    detailsTitle = selectedNode.data.step.label
  }

  return (
    <aside ref={inspectorRef} className={styles.inspector} tabIndex={-1} aria-label="Workflow details">
      <div className={styles.inspectorHeader}>
        <Title3>{detailsTitle}</Title3>
        <Button appearance="subtle" icon={<ChevronRightRegular />} aria-label="Close properties" onClick={close} />
      </div>
      {selectedEdge !== undefined && (
        <SelectedConnectionInspector
          edge={selectedEdge}
          nodes={nodes}
          changeEdge={changeEdge}
          remove={removeSelectedEdge}
        />
      )}
      {selectedEdge === undefined && selectedNode === undefined && (
        <div className={styles.fields}>
          <Field label="Test trigger" hint="Webhook events and schedule fires are injected after external ingress.">
            <Dropdown
              placeholder="Select a trigger"
              value={testTriggers.find(({ id }) => id === testTriggerId)?.label ?? ""}
              selectedOptions={testTriggerId === undefined ? [] : [testTriggerId]}
              onOptionSelect={(_, data) => {
                if (data.optionValue !== undefined) {
                  setTestTriggerId(data.optionValue)
                }
              }}
            >
              {testTriggers.map((trigger) => (
                <Option key={trigger.id} value={trigger.id}>
                  {trigger.label}
                </Option>
              ))}
            </Dropdown>
          </Field>
          <WorkflowTestInputEditor
            schema={draft.content.inputSchema}
            value={testInput}
            onChange={setTestInput}
            showValidation={showTestInputValidation}
          />
          <Body1>Draft revision {draft.draftRevision}</Body1>
          {draft.versions.map((version) => (
            <Badge key={version.version} appearance="outline">
              Version {version.version}
            </Badge>
          ))}
        </div>
      )}
      {selectedEdge === undefined && selectedNode !== undefined && (
        <StepInspector
          node={selectedNode}
          nodes={nodes}
          edges={edges.filter((edge) => edge.source === selectedNode.id || edge.target === selectedNode.id)}
          changeStep={changeStep}
          repository={repository}
          changeEdge={changeEdge}
          remove={removeSelectedStep}
        />
      )}
    </aside>
  )
}

function StepInspector({
  node,
  nodes,
  edges,
  repository,
  changeStep,
  changeEdge,
  remove
}: {
  node: CanvasNode
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  repository: WorkflowDraftContent["resourceBindings"][string] | undefined
  changeStep: (step: WorkflowStep, resourceBinding?: WorkflowDraftContent["resourceBindings"][string] | null) => void
  changeEdge: (edge: CanvasEdge) => void
  remove: () => void
}) {
  const styles = useWorkflowEditorInspectorStyles()
  const { step, definition } = node.data
  let expressionField: "cases" | "condition" | "expression" = "expression"
  if (definition.kind === "switch") {
    expressionField = "cases"
  }
  if (definition.kind === "bounded_loop") {
    expressionField = "condition"
  }
  return (
    <div className={styles.fields}>
      <Field label="Label">
        <Input value={step.label} onChange={(_, data) => changeStep({ ...step, label: data.value })} />
      </Field>
      <Caption1 className={styles.hint}>{definition.description}</Caption1>
      {definition.kind === "set_fields" && (
        <ObjectRowsField
          key={`${step.id}:fields`}
          label="Fields"
          keyLabel="Field name"
          valueLabel="Value"
          value={step.config.fields}
          valueMode="json"
          onChange={(fields) => changeStep({ ...step, config: { ...step.config, fields } })}
        />
      )}
      {definition.kind === "map_fields" && (
        <ObjectRowsField
          key={`${step.id}:mappings`}
          label="Mappings"
          keyLabel="Output field"
          valueLabel="Source path"
          value={step.config.mappings}
          valueMode="text"
          onChange={(mappings) => changeStep({ ...step, config: { ...step.config, mappings } })}
        />
      )}
      {definition.kind === "validate" && (
        <AdvancedSection label="Advanced schema">
          <DraftJsonField
            key={`${step.id}:validation-schema`}
            label="Validation schema"
            value={step.config.schema ?? { type: "object", properties: {} }}
            invalidMessage="Enter valid JSON Schema."
            onChange={(schema) => changeStep({ ...step, config: { ...step.config, schema } })}
          />
        </AdvancedSection>
      )}
      {definition.kind === "failure" && (
        <>
          <Field label="Failure code">
            <Input
              value={typeof step.config.code === "string" ? step.config.code : ""}
              onChange={(_, data) => changeStep({ ...step, config: { ...step.config, code: data.value } })}
            />
          </Field>
          <Field label="Message">
            <Textarea
              value={typeof step.config.message === "string" ? step.config.message : ""}
              onChange={(_, data) => changeStep({ ...step, config: { ...step.config, message: data.value } })}
            />
          </Field>
        </>
      )}
      {definition.kind === "compose_markdown" && (
        <Field label="Markdown template" hint="Insert declared values with {{path.to.value}}">
          <Textarea
            resize="vertical"
            value={typeof step.config.template === "string" ? step.config.template : ""}
            onChange={(_, data) => changeStep({ ...step, config: { ...step.config, template: data.value } })}
          />
        </Field>
      )}
      {definition.kind === "collect" && (
        <>
          <Field label="Collection mode">
            <Dropdown
              value={step.config.mode === "keyed" ? "Keyed object" : "Ordered array"}
              selectedOptions={[step.config.mode === "keyed" ? "keyed" : "array"]}
              onOptionSelect={(_, data) =>
                changeStep({ ...step, config: { ...step.config, mode: data.optionValue ?? "array" } })
              }
            >
              <Option value="array">Ordered array</Option>
              <Option value="keyed">Keyed object</Option>
            </Dropdown>
          </Field>
          {step.config.mode === "keyed" && (
            <Field label="Key field">
              <Input
                value={typeof step.config.keyField === "string" ? step.config.keyField : ""}
                onChange={(_, data) => changeStep({ ...step, config: { ...step.config, keyField: data.value } })}
              />
            </Field>
          )}
          <Field label="Maximum items">
            <Input
              type="number"
              min={1}
              max={1000}
              value={String(typeof step.config.maximumItems === "number" ? step.config.maximumItems : 100)}
              onChange={(_, data) => {
                const maximumItems = Number(data.value)
                if (Number.isInteger(maximumItems) && maximumItems >= 1 && maximumItems <= 1000) {
                  changeStep({ ...step, config: { ...step.config, maximumItems } })
                }
              }}
            />
          </Field>
        </>
      )}
      {definition.kind === "repository_data" && (
        <RepositoryDataInspector step={step} repository={repository} changeStep={changeStep} />
      )}
      {definition.kind === "repository_agent" && (
        <RepositoryAgentInspector step={step} repository={repository} changeStep={changeStep} />
      )}
      {definition.kind === "ai_model" && <AiModelInspector step={step} changeStep={changeStep} />}
      {definition.kind === "structured_judgment" && <StructuredJudgmentInspector step={step} changeStep={changeStep} />}
      {definition.kind === "provider_event" && <ProviderEventInspector step={step} changeStep={changeStep} />}
      {definition.kind === "schedule" && <ScheduleInspector step={step} changeStep={changeStep} />}
      {definition.kind === "provider_data" && (
        <ProviderStepInspector mode="read" step={step} repository={repository} changeStep={changeStep} />
      )}
      {definition.kind === "provider_action" && (
        <ProviderStepInspector mode="write" step={step} repository={repository} changeStep={changeStep} />
      )}
      {(definition.kind === "condition" || definition.kind === "switch" || definition.kind === "bounded_loop") && (
        <ExpressionInspector step={step} field={expressionField} changeStep={changeStep} />
      )}
      {definition.kind === "switch" && (
        <Field label="Default branch key">
          <Input
            value={typeof step.config.defaultKey === "string" ? step.config.defaultKey : ""}
            onChange={(_, data) => changeStep({ ...step, config: { ...step.config, defaultKey: data.value } })}
          />
        </Field>
      )}
      {(definition.kind === "condition" || definition.kind === "switch") && (
        <StepReferenceField
          label="Merge step"
          value={step.config.joinStepId}
          nodes={nodes}
          kinds={["exclusive_merge"]}
          onChange={(joinStepId) => changeStep({ ...step, config: { ...step.config, joinStepId } })}
        />
      )}
      {definition.kind === "for_each" && <ForEachInspector step={step} nodes={nodes} changeStep={changeStep} />}
      {definition.kind === "join" && <JoinInspector step={step} changeStep={changeStep} />}
      {definition.kind === "bounded_loop" && <BoundedLoopInspector step={step} nodes={nodes} changeStep={changeStep} />}
      {definition.kind === "wait" && <WaitInspector step={step} changeStep={changeStep} />}
      {definition.kind === "child_workflow" && <ChildWorkflowInspector step={step} changeStep={changeStep} />}
      {edges.length > 0 && <ConnectionInspector node={node} edges={edges} changeEdge={changeEdge} />}
      <Button appearance="subtle" icon={<DeleteRegular />} onClick={remove}>
        Delete step
      </Button>
    </div>
  )
}

function StepReferenceField({
  label,
  value,
  nodes,
  kinds,
  onChange
}: {
  label: string
  value: JsonValue | undefined
  nodes: CanvasNode[]
  kinds?: string[]
  onChange: (stepId: string) => void
}) {
  const options = kinds === undefined ? nodes : nodes.filter(({ data }) => kinds.includes(data.definition.kind))
  const selected = typeof value === "string" ? value : ""
  const labelValue = options.find(({ id }) => id === selected)?.data.step.label ?? ""
  return (
    <Field label={label}>
      <Dropdown
        placeholder="Select a step"
        value={labelValue}
        selectedOptions={selected === "" ? [] : [selected]}
        onOptionSelect={(_, data) => onChange(data.optionValue ?? "")}
      >
        {options.map(({ id, data }) => (
          <Option key={id} value={id}>
            {data.step.label}
          </Option>
        ))}
      </Dropdown>
    </Field>
  )
}

function ExpressionInspector({
  step,
  field,
  changeStep
}: {
  step: WorkflowStep
  field: "expression" | "condition" | "cases"
  changeStep: (step: WorkflowStep) => void
}) {
  if (field === "cases") {
    return (
      <SwitchCasesField
        key={`${step.id}:cases`}
        value={step.config.cases}
        onChange={(cases) => changeStep({ ...step, config: { ...step.config, cases } })}
      />
    )
  }
  const raw = step.config[field]
  const expression = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {}
  const path = Array.isArray(expression.path)
    ? expression.path.filter((item): item is string => typeof item === "string").join(".")
    : ""
  const operator = typeof expression.operator === "string" ? expression.operator : "truthy"
  return (
    <>
      <Field label="Expression path">
        <Input
          value={path}
          placeholder="issue.priority"
          onChange={(_, data) =>
            changeStep({
              ...step,
              config: { ...step.config, [field]: { ...expression, path: data.value.split(".").filter(Boolean) } }
            })
          }
        />
      </Field>
      <Field label="Operator">
        <Dropdown
          value={operator.replaceAll("_", " ")}
          selectedOptions={[operator]}
          onOptionSelect={(_, data) =>
            changeStep({
              ...step,
              config: { ...step.config, [field]: { ...expression, operator: data.optionValue ?? "truthy" } }
            })
          }
        >
          {[
            "equals",
            "not_equals",
            "greater_than",
            "greater_than_or_equal",
            "less_than",
            "less_than_or_equal",
            "exists",
            "truthy"
          ].map((item) => (
            <Option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {operator !== "exists" && operator !== "truthy" && (
        <DraftJsonField
          key={`${step.id}:${field}:value`}
          label="Comparison value"
          value={expression.value ?? null}
          onChange={(value) => changeStep({ ...step, config: { ...step.config, [field]: { ...expression, value } } })}
        />
      )}
    </>
  )
}

function ForEachInspector({
  step,
  nodes,
  changeStep
}: {
  step: WorkflowStep
  nodes: CanvasNode[]
  changeStep: (step: WorkflowStep) => void
}) {
  return (
    <>
      <Field label="Maximum items">
        <Input
          type="number"
          min={1}
          max={1000}
          value={String(step.config.maximumItems ?? 100)}
          onChange={(_, data) => {
            const maximumItems = Number(data.value)
            if (Number.isInteger(maximumItems) && maximumItems >= 1 && maximumItems <= 1000) {
              changeStep({ ...step, config: { ...step.config, maximumItems } })
            }
          }}
        />
      </Field>
      <Field label="Concurrency">
        <Input
          type="number"
          min={1}
          max={1000}
          value={String(step.config.concurrency ?? 4)}
          onChange={(_, data) => {
            const concurrency = Number(data.value)
            if (Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 1000) {
              changeStep({ ...step, config: { ...step.config, concurrency } })
            }
          }}
        />
      </Field>
      <StepReferenceField
        label="Body step"
        value={step.config.bodyStepId}
        nodes={nodes.filter(({ id }) => id !== step.id)}
        onChange={(bodyStepId) => changeStep({ ...step, config: { ...step.config, bodyStepId } })}
      />
      <StepReferenceField
        label="Join step"
        value={step.config.joinStepId}
        nodes={nodes}
        kinds={["join"]}
        onChange={(joinStepId) => changeStep({ ...step, config: { ...step.config, joinStepId } })}
      />
    </>
  )
}

function JoinInspector({ step, changeStep }: { step: WorkflowStep; changeStep: (step: WorkflowStep) => void }) {
  const policy = typeof step.config.policy === "string" ? step.config.policy : "all"
  return (
    <>
      <Field label="Join policy">
        <Dropdown
          value={policy}
          selectedOptions={[policy]}
          onOptionSelect={(_, data) => {
            const next = data.optionValue ?? "all"
            const config =
              next === "quorum"
                ? {
                    ...step.config,
                    policy: next,
                    quorum: typeof step.config.quorum === "number" ? step.config.quorum : 1
                  }
                : { policy: next }
            changeStep({ ...step, config })
          }}
        >
          <Option value="all">All</Option>
          <Option value="any">Any</Option>
          <Option value="quorum">Quorum</Option>
        </Dropdown>
      </Field>
      {policy === "quorum" && (
        <Field label="Quorum">
          <Input
            type="number"
            min={1}
            value={String(step.config.quorum ?? 1)}
            onChange={(_, data) => {
              const quorum = Number(data.value)
              if (Number.isInteger(quorum) && quorum >= 1) {
                changeStep({ ...step, config: { ...step.config, quorum } })
              }
            }}
          />
        </Field>
      )}
    </>
  )
}

function BoundedLoopInspector({
  step,
  nodes,
  changeStep
}: {
  step: WorkflowStep
  nodes: CanvasNode[]
  changeStep: (step: WorkflowStep) => void
}) {
  return (
    <>
      <Field label="Maximum iterations">
        <Input
          type="number"
          min={1}
          max={1000}
          value={String(step.config.maximumIterations ?? 10)}
          onChange={(_, data) => {
            const maximumIterations = Number(data.value)
            if (Number.isInteger(maximumIterations) && maximumIterations >= 1 && maximumIterations <= 1000) {
              changeStep({ ...step, config: { ...step.config, maximumIterations } })
            }
          }}
        />
      </Field>
      <Field label="Maximum activations">
        <Input
          type="number"
          min={1}
          max={100000}
          value={String(step.config.maximumActivations ?? 100)}
          onChange={(_, data) => {
            const maximumActivations = Number(data.value)
            if (Number.isInteger(maximumActivations) && maximumActivations >= 1 && maximumActivations <= 100000) {
              changeStep({ ...step, config: { ...step.config, maximumActivations } })
            }
          }}
        />
      </Field>
      <StepReferenceField
        label="Body step"
        value={step.config.bodyStepId}
        nodes={nodes.filter(({ id }) => id !== step.id)}
        onChange={(bodyStepId) => changeStep({ ...step, config: { ...step.config, bodyStepId } })}
      />
      <StepReferenceField
        label="Exit step"
        value={step.config.exitStepId}
        nodes={nodes.filter(({ id }) => id !== step.id)}
        onChange={(exitStepId) => changeStep({ ...step, config: { ...step.config, exitStepId } })}
      />
      <Field label="On exhaustion">
        <Dropdown
          value={step.config.onExhaustion === "complete" ? "Complete" : "Fail"}
          selectedOptions={[step.config.onExhaustion === "complete" ? "complete" : "fail"]}
          onOptionSelect={(_, data) =>
            changeStep({
              ...step,
              config: { ...step.config, onExhaustion: data.optionValue === "complete" ? "complete" : "fail" }
            })
          }
        >
          <Option value="fail">Fail</Option>
          <Option value="complete">Complete</Option>
        </Dropdown>
      </Field>
    </>
  )
}

function WaitInspector({ step, changeStep }: { step: WorkflowStep; changeStep: (step: WorkflowStep) => void }) {
  return (
    <>
      <Field label="Correlation key" hint="Use {{path}} placeholders from wait context">
        <Input
          value={typeof step.config.correlation === "string" ? step.config.correlation : ""}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, correlation: data.value } })}
        />
      </Field>
      <Field label="Expires after seconds">
        <Input
          type="number"
          min={1}
          value={String(step.config.expiresAfterSeconds ?? 3600)}
          onChange={(_, data) => {
            const expiresAfterSeconds = Number(data.value)
            if (Number.isInteger(expiresAfterSeconds) && expiresAfterSeconds >= 1) {
              changeStep({ ...step, config: { ...step.config, expiresAfterSeconds } })
            }
          }}
        />
      </Field>
      <JsonSchemaField
        label="Resume event schema"
        value={step.config.eventSchema}
        onChange={(eventSchema) => changeStep({ ...step, config: { ...step.config, eventSchema } })}
      />
    </>
  )
}

function ChildWorkflowInspector({
  step,
  changeStep
}: {
  step: WorkflowStep
  changeStep: (step: WorkflowStep) => void
}) {
  return (
    <AdvancedSection label="Advanced package references">
      <Field label="Execution package digest">
        <Input
          value={typeof step.config.packageDigest === "string" ? step.config.packageDigest : ""}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, packageDigest: data.value.trim() } })}
        />
      </Field>
      <Field label="Interface digest">
        <Input
          value={typeof step.config.interfaceDigest === "string" ? step.config.interfaceDigest : ""}
          onChange={(_, data) =>
            changeStep({ ...step, config: { ...step.config, interfaceDigest: data.value.trim() } })
          }
        />
      </Field>
    </AdvancedSection>
  )
}

function ConnectionInspector({
  node,
  edges,
  changeEdge
}: {
  node: CanvasNode
  edges: CanvasEdge[]
  changeEdge: (edge: CanvasEdge) => void
}) {
  const styles = useWorkflowEditorInspectorStyles()
  return (
    <>
      {edges.map((edge) => {
        const outgoing = edge.source === node.id
        return (
          <div key={edge.id}>
            {outgoing && node.data.definition.kind === "switch" && (
              <Field label="Branch key">
                <Input
                  value={edge.data?.branchKey ?? ""}
                  onChange={(_, data) =>
                    changeEdge({
                      ...edge,
                      data: { mappings: edge.data?.mappings ?? [], ...edge.data, branchKey: data.value }
                    })
                  }
                />
              </Field>
            )}
            {edge.target === node.id && node.data.definition.kind === "bounded_loop" && (
              <Field label="Loop-back">
                <Dropdown
                  value={edge.data?.loopBack === true ? "Loop back" : "Initial state"}
                  selectedOptions={[edge.data?.loopBack === true ? "true" : "false"]}
                  onOptionSelect={(_, data) =>
                    changeEdge({
                      ...edge,
                      data: { mappings: edge.data?.mappings ?? [], ...edge.data, loopBack: data.optionValue === "true" }
                    })
                  }
                >
                  <Option value="false">Initial state</Option>
                  <Option value="true">Loop back</Option>
                </Dropdown>
              </Field>
            )}
          </div>
        )
      })}
    </>
  )
}

function SelectedConnectionInspector({
  edge,
  nodes,
  changeEdge,
  remove
}: {
  edge: CanvasEdge
  nodes: CanvasNode[]
  changeEdge: (edge: CanvasEdge) => void
  remove: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const source = nodes.find(({ id }) => id === edge.source)
  const target = nodes.find(({ id }) => id === edge.target)
  return (
    <div className={useWorkflowEditorInspectorStyles().fields}>
      <Field label="From">
        <Dropdown
          value={source?.data.step.label ?? ""}
          selectedOptions={[edge.source]}
          onOptionSelect={(_, data) => {
            const next = nodes.find(({ id }) => id === data.optionValue)
            const sourceHandle = next?.data.definition.outputs[0]?.name
            if (next !== undefined && sourceHandle !== undefined) {
              changeEdge({ ...edge, source: next.id, sourceHandle })
            }
          }}
        >
          {nodes
            .filter(({ data }) => data.definition.outputs.length > 0)
            .map(({ id, data }) => (
              <Option key={id} value={id}>
                {data.step.label}
              </Option>
            ))}
        </Dropdown>
      </Field>
      <Field label="To">
        <Dropdown
          value={target?.data.step.label ?? ""}
          selectedOptions={[edge.target]}
          onOptionSelect={(_, data) => {
            const next = nodes.find(({ id }) => id === data.optionValue)
            const targetHandle = next?.data.definition.inputs[0]?.name
            if (next !== undefined && targetHandle !== undefined) {
              changeEdge({ ...edge, target: next.id, targetHandle })
            }
          }}
        >
          {nodes
            .filter(({ data }) => data.definition.inputs.length > 0)
            .map(({ id, data }) => (
              <Option key={id} value={id}>
                {data.step.label}
              </Option>
            ))}
        </Dropdown>
      </Field>
      <ConnectionMappingsField
        value={edge.data?.mappings ?? []}
        onChange={(mappings) => changeEdge({ ...edge, data: { ...edge.data, mappings } })}
      />
      <Button appearance="subtle" icon={<DeleteRegular />} onClick={() => setConfirmDelete(true)}>
        Delete connection
      </Button>
      <Dialog open={confirmDelete} onOpenChange={(_, data) => setConfirmDelete(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Delete connection?</DialogTitle>
            <DialogContent>The connected steps will remain in the workflow.</DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={remove}>
                Delete
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  )
}

type RepositoryInventoryItem = IntegrationResourceInventory["resources"][number]
type RepositorySelection = { owner: string; name: string; ref: string }
type PromptMessage = { role: "system" | "developer" | "user"; content: string }

function selectedRepository(step: WorkflowStep): RepositorySelection {
  const repository = step.config.repository
  if (repository === null || typeof repository !== "object" || Array.isArray(repository)) {
    return { owner: "", name: "", ref: "main" }
  }
  return {
    owner: typeof repository.owner === "string" ? repository.owner : "",
    name: typeof repository.name === "string" ? repository.name : "",
    ref: typeof repository.ref === "string" ? repository.ref : "main"
  }
}

function RepositoryDataInspector({
  step,
  repository: workflowRepository,
  changeStep
}: {
  step: WorkflowStep
  repository: ResourceBinding | undefined
  changeStep: (step: WorkflowStep) => void
}) {
  const repository = selectedRepository(step)
  const operations = [
    "metadata",
    "file_content",
    "commit",
    "code_search",
    "pull_request",
    "pull_request_files",
    "checks",
    "reviews",
    "comments"
  ]
  if (workflowRepository === undefined) {
    return <Caption1>This workflow has no repository.</Caption1>
  }
  return (
    <>
      <Field label="Repository">
        <Input readOnly value={workflowRepository.name} />
      </Field>
      <Field label="Operation">
        <Dropdown
          value={typeof step.config.operation === "string" ? step.config.operation.replaceAll("_", " ") : "metadata"}
          selectedOptions={[typeof step.config.operation === "string" ? step.config.operation : "metadata"]}
          onOptionSelect={(_, data) =>
            changeStep({ ...step, config: { ...step.config, operation: data.optionValue ?? "metadata" } })
          }
        >
          {operations.map((operation) => (
            <Option key={operation} value={operation}>
              {operation.replaceAll("_", " ")}
            </Option>
          ))}
        </Dropdown>
      </Field>
      <Field label="Repository ref">
        <Input
          value={repository.ref}
          onChange={(_, data) =>
            changeStep({ ...step, config: { ...step.config, repository: { ...repository, ref: data.value } } })
          }
        />
      </Field>
    </>
  )
}

function RepositoryAgentInspector({
  step,
  repository,
  changeStep
}: {
  step: WorkflowStep
  repository: ResourceBinding | undefined
  changeStep: (step: WorkflowStep) => void
}) {
  const current = parseRepositoryAgentReference(step.config.agentReference)
  const [agents, setAgents] = useState<RepositoryAgentReference[]>([])
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState("")

  function discover() {
    if (repository === undefined) {
      return
    }
    setState("loading")
    setError("")
    void discoverRepositoryAgents({
      connectionId: repository.connectionId,
      repositoryId: repository.externalId,
      repositoryName: repository.name,
      ref: current?.ref ?? "HEAD"
    })
      .then((result) => {
        setAgents(result)
        setState("ready")
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Agent definitions could not be loaded")
        setState("error")
      })
  }

  if (repository === undefined) {
    return <Caption1>This workflow has no repository.</Caption1>
  }
  return (
    <>
      <Field label="Repository">
        <Input readOnly value={repository.name} />
      </Field>
      <Button disabled={state === "loading"} onClick={discover}>
        {state === "loading" ? "Finding agents" : "Find agents"}
      </Button>
      {state === "error" && <Caption1>{error}</Caption1>}
      {state === "ready" && agents.length === 0 && <Caption1>No repository agents were found.</Caption1>}
      {agents.length > 0 && (
        <Field label="Agent definition">
          <Dropdown
            placeholder="Select an agent"
            value={current?.name ?? ""}
            selectedOptions={current === undefined ? [] : [current.contentDigest]}
            onOptionSelect={(_, data) => {
              const selected = agents.find(({ contentDigest }) => contentDigest === data.optionValue)
              if (selected !== undefined) {
                changeStep({ ...step, config: { ...step.config, agentReference: selected } })
              }
            }}
          >
            {agents.map((agent) => (
              <Option key={agent.contentDigest} value={agent.contentDigest} text={`${agent.name}, ${agent.path}`}>
                {agent.name}
                <Caption1>{agent.path}</Caption1>
              </Option>
            ))}
          </Dropdown>
        </Field>
      )}
      {current !== undefined && (
        <>
          <Caption1>{current.description}</Caption1>
          <Caption1>Observed at {current.observedCommitSha.slice(0, 12)}</Caption1>
          <Link href={current.sourceUrl} target="_blank" rel="noreferrer">
            Open in GitHub
          </Link>
        </>
      )}
      <Field label="Instructions">
        <Textarea
          resize="vertical"
          value={typeof step.config.instructions === "string" ? step.config.instructions : ""}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, instructions: data.value } })}
        />
      </Field>
    </>
  )
}

function useWorkflowModels() {
  const [models, setModels] = useState<WorkflowModelSnapshot[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void listWorkflowModels()
      .then((result) => {
        if (!active) {
          return
        }
        setModels(result)
        setState("ready")
      })
      .catch((reason: unknown) => {
        if (!active) {
          return
        }
        setError(reason instanceof Error ? reason.message : "Models could not be loaded")
        setState("error")
      })
    return () => {
      active = false
    }
  }, [])
  return { models, state, error }
}

function ModelPicker({
  models,
  value,
  onSelect
}: {
  models: WorkflowModelSnapshot[]
  value: string
  onSelect: (model: WorkflowModelSnapshot) => void
}) {
  const selected = models.find(({ modelId }) => modelId === value)
  return (
    <>
      <Field label="Model">
        <Dropdown
          placeholder="Search and select a model"
          value={selected?.name ?? value}
          selectedOptions={value === "" ? [] : [value]}
          onOptionSelect={(_, data) => {
            const model = models.find(({ modelId }) => modelId === data.optionValue)
            if (model !== undefined) {
              onSelect(model)
            }
          }}
        >
          {models.map((model) => (
            <Option key={model.modelId} value={model.modelId} text={`${model.name} ${model.modelId}`}>
              {model.name}
              <Caption1>{model.modelId}</Caption1>
            </Option>
          ))}
        </Dropdown>
      </Field>
      {selected !== undefined && (
        <Caption1>
          {selected.contextLength.toLocaleString()} token context. Observed{" "}
          {new Date(selected.observedAt).toLocaleDateString()}.
        </Caption1>
      )}
    </>
  )
}

function promptMessages(value: JsonValue | undefined): PromptMessage[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((item) => {
    if (item === null || Array.isArray(item) || typeof item !== "object") {
      return []
    }
    if (
      (item.role !== "system" && item.role !== "developer" && item.role !== "user") ||
      typeof item.content !== "string"
    ) {
      return []
    }
    return [{ role: item.role, content: item.content }]
  })
}

function modelParameters(value: JsonValue | undefined): Record<string, JsonValue> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }
  return value
}

function ModelCatalogState({
  state,
  error,
  models,
  children
}: {
  state: "loading" | "ready" | "error"
  error: string
  models: WorkflowModelSnapshot[]
  children: ReactNode
}) {
  if (state === "loading") {
    return <Spinner size="tiny" label="Loading models" />
  }
  if (state === "error") {
    return <Caption1>{error}</Caption1>
  }
  if (models.length === 0) {
    return <Caption1>No OpenRouter models are available.</Caption1>
  }
  return children
}

function SchemaGenerator({
  modelId,
  modelName,
  initialPrompt,
  onApply
}: {
  modelId: string
  modelName: string
  initialPrompt: string
  onApply: (schema: JsonValue) => void
}) {
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [proposal, setProposal] = useState<JsonValue | undefined>()
  const [error, setError] = useState("")
  const [generating, setGenerating] = useState(false)

  async function generate(): Promise<void> {
    setGenerating(true)
    setError("")
    try {
      setProposal(await generateWorkflowSchema({ modelId, prompt }))
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Schema generation failed.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <>
      <Button
        disabled={modelId === ""}
        onClick={() => {
          setPrompt(initialPrompt)
          setProposal(undefined)
          setError("")
          setOpen(true)
        }}
      >
        Generate schema
      </Button>
      <Dialog open={open} onOpenChange={(_, data) => setOpen(data.open)}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Generate output schema</DialogTitle>
            <DialogContent>
              <Body1>
                Generating a proposal calls {modelName} through OpenRouter and may incur model charges. Review and edit
                the proposal before using it.
              </Body1>
              <Field label="Output description or example">
                <Textarea resize="vertical" value={prompt} onChange={(_, data) => setPrompt(data.value)} />
              </Field>
              {error === "" ? null : <Caption1>{error}</Caption1>}
              {proposal === undefined ? null : (
                <DraftJsonField
                  label="Schema proposal"
                  value={proposal}
                  invalidMessage="Enter valid JSON Schema."
                  onChange={setProposal}
                />
              )}
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                appearance="secondary"
                disabled={generating || prompt.trim() === ""}
                onClick={() => void generate()}
              >
                {generating ? "Generating" : "Generate proposal"}
              </Button>
              <Button
                appearance="primary"
                disabled={proposal === undefined || supportedJsonSchemaError(proposal) !== null}
                onClick={() => {
                  if (proposal === undefined || supportedJsonSchemaError(proposal) !== null) {
                    return
                  }
                  onApply(proposal)
                  setOpen(false)
                }}
              >
                Use schema
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  )
}

function AiModelInspector({ step, changeStep }: { step: WorkflowStep; changeStep: (step: WorkflowStep) => void }) {
  const { models, state, error } = useWorkflowModels()
  const messages = promptMessages(step.config.messages)
  const modelId = typeof step.config.modelId === "string" ? step.config.modelId : ""
  const selected = models.find((model) => model.modelId === modelId)
  const outputMode =
    step.config.outputMode === "markdown" || step.config.outputMode === "structured" ? step.config.outputMode : "text"
  const parameters = modelParameters(step.config.parameters)
  const promptCharacters = messages.reduce((total, message) => total + message.content.length, 0)

  function changeMessage(index: number, message: PromptMessage) {
    changeStep({
      ...step,
      config: {
        ...step.config,
        messages: messages.map((current, currentIndex) => (currentIndex === index ? message : current))
      }
    })
  }

  return (
    <ModelCatalogState state={state} error={error} models={models}>
      <ModelPicker
        models={models}
        value={modelId}
        onSelect={(model) => changeStep({ ...step, config: { ...step.config, modelId: model.modelId } })}
      />
      {messages.map((message, index) => (
        <div key={`${index}-${message.role}`}>
          <Field label={`Message ${index + 1}`}>
            <Dropdown
              value={message.role}
              selectedOptions={[message.role]}
              onOptionSelect={(_, data) =>
                changeMessage(index, {
                  ...message,
                  role: data.optionValue === "developer" || data.optionValue === "system" ? data.optionValue : "user"
                })
              }
            >
              <Option value="system">System</Option>
              <Option value="developer">Developer</Option>
              <Option value="user">User</Option>
            </Dropdown>
          </Field>
          <Field label={`${message.role} prompt`}>
            <Textarea
              resize="vertical"
              value={message.content}
              onChange={(_, data) => changeMessage(index, { ...message, content: data.value })}
            />
          </Field>
          <Button
            appearance="subtle"
            disabled={messages.length === 1}
            onClick={() =>
              changeStep({
                ...step,
                config: { ...step.config, messages: messages.filter((_, currentIndex) => currentIndex !== index) }
              })
            }
          >
            Remove message
          </Button>
        </div>
      ))}
      <Button
        onClick={() =>
          changeStep({ ...step, config: { ...step.config, messages: [...messages, { role: "user", content: "" }] } })
        }
      >
        Add message
      </Button>
      <Button
        appearance="subtle"
        onClick={() => {
          const lastIndex = Math.max(0, messages.length - 1)
          const current = messages[lastIndex] ?? { role: "user", content: "" }
          changeMessage(lastIndex, { ...current, content: `${current.content}{{context}}` })
        }}
      >
        Use workflow context
      </Button>
      <Caption1>
        Estimated prompt: {Math.ceil(promptCharacters / 4).toLocaleString()} tokens
        {selected === undefined ? "" : ` of ${selected.contextLength.toLocaleString()}`}
      </Caption1>
      <Field label="Output format">
        <Dropdown
          value={outputMode}
          selectedOptions={[outputMode]}
          onOptionSelect={(_, data) => {
            const next =
              data.optionValue === "markdown" || data.optionValue === "structured" ? data.optionValue : "text"
            changeStep({ ...step, config: { ...step.config, outputMode: next } })
          }}
        >
          <Option value="text">Text</Option>
          <Option value="markdown">Markdown artifact</Option>
          <Option
            value="structured"
            disabled={selected !== undefined && !selected.supportedParameters.includes("response_format")}
          >
            Structured JSON
          </Option>
        </Dropdown>
      </Field>
      {outputMode === "structured" && (
        <>
          <JsonSchemaField
            key={`${step.id}:output-schema`}
            label="Output schema"
            value={step.config.outputSchema}
            onChange={(outputSchema) => changeStep({ ...step, config: { ...step.config, outputSchema } })}
          />
          <SchemaGenerator
            modelId={modelId}
            modelName={selected?.name ?? modelId}
            initialPrompt={messages.map((message) => message.content).join("\n\n")}
            onApply={(outputSchema) => changeStep({ ...step, config: { ...step.config, outputSchema } })}
          />
        </>
      )}
      <Field label="Temperature">
        <Input
          type="number"
          min={0}
          max={2}
          step={0.1}
          value={String(typeof parameters.temperature === "number" ? parameters.temperature : 0.2)}
          onChange={(_, data) => {
            const temperature = Number(data.value)
            if (Number.isFinite(temperature) && temperature >= 0 && temperature <= 2) {
              changeStep({ ...step, config: { ...step.config, parameters: { ...parameters, temperature } } })
            }
          }}
        />
      </Field>
      <Field label="Maximum completion tokens">
        <Input
          type="number"
          min={1}
          max={65536}
          value={String(typeof parameters.max_tokens === "number" ? parameters.max_tokens : 2000)}
          onChange={(_, data) => {
            const maxTokens = Number(data.value)
            if (Number.isInteger(maxTokens) && maxTokens >= 1 && maxTokens <= 65536) {
              changeStep({ ...step, config: { ...step.config, parameters: { ...parameters, max_tokens: maxTokens } } })
            }
          }}
        />
      </Field>
    </ModelCatalogState>
  )
}

function JsonSchemaField({
  label,
  value,
  onChange
}: {
  label: string
  value: JsonValue | undefined
  onChange: (value: JsonValue) => void
}) {
  return (
    <AdvancedSection label="Advanced schema">
      <DraftJsonField
        label={label}
        value={value ?? { type: "object", properties: {} }}
        invalidMessage="Enter valid JSON Schema."
        onChange={onChange}
      />
    </AdvancedSection>
  )
}

function AdvancedSection({ label, children }: { label: string; children: ReactNode }) {
  const styles = useWorkflowEditorInspectorStyles()
  return (
    <details className={styles.advanced}>
      <summary aria-label={`Toggle ${label.toLowerCase()}`}>{label}</summary>
      <div>{children}</div>
    </details>
  )
}

function StructuredJudgmentInspector({
  step,
  changeStep
}: {
  step: WorkflowStep
  changeStep: (step: WorkflowStep) => void
}) {
  const { models, state, error } = useWorkflowModels()
  const modelId = typeof step.config.modelId === "string" ? step.config.modelId : ""
  const selected = models.find((model) => model.modelId === modelId)
  const criteria = typeof step.config.criteria === "string" ? step.config.criteria : ""
  return (
    <ModelCatalogState state={state} error={error} models={models}>
      <ModelPicker
        models={models.filter((model) => model.supportedParameters.includes("response_format"))}
        value={modelId}
        onSelect={(model) => changeStep({ ...step, config: { ...step.config, modelId: model.modelId } })}
      />
      <Field label="Judgment criteria">
        <Textarea
          resize="vertical"
          value={criteria}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, criteria: data.value } })}
        />
      </Field>
      <JsonSchemaField
        key={`${step.id}:judgment-schema`}
        label="Judgment output schema"
        value={step.config.outputSchema}
        onChange={(outputSchema) => changeStep({ ...step, config: { ...step.config, outputSchema } })}
      />
      <SchemaGenerator
        modelId={modelId}
        modelName={selected?.name ?? modelId}
        initialPrompt={criteria}
        onApply={(outputSchema) => changeStep({ ...step, config: { ...step.config, outputSchema } })}
      />
      <Caption1>The model receives mapped evidence as untrusted data and must return this schema.</Caption1>
    </ModelCatalogState>
  )
}

function ProviderEventInspector({ step, changeStep }: { step: WorkflowStep; changeStep: ProviderChangeStep }) {
  const { inventory, state, error } = useProviderInventory()
  const eventState = useProviderEvents()
  const provider = step.config.provider === "linear" ? "linear" : "github"
  const events = eventState.events.filter((event) => event.provider === provider)
  const configuredEventKey = typeof step.config.eventKey === "string" ? step.config.eventKey : ""
  const selectedEvent = events.find((event) => event.eventKey === configuredEventKey) ?? events[0]
  useEffect(() => {
    if (eventState.state === "ready" && configuredEventKey === "" && selectedEvent !== undefined) {
      changeStep({ ...step, config: { ...step.config, eventKey: selectedEvent.eventKey } })
    }
  }, [changeStep, configuredEventKey, eventState.state, selectedEvent, step])
  if (eventState.state === "loading") {
    return <Spinner size="tiny" label="Loading provider events" />
  }
  if (eventState.state === "error") {
    return <Caption1>{eventState.error}</Caption1>
  }
  if (selectedEvent === undefined) {
    return <Caption1>No {provider === "github" ? "GitHub" : "Linear"} events are available.</Caption1>
  }
  return (
    <ProviderState state={state} error={error} inventory={inventory}>
      <Field label="Event">
        <Dropdown
          value={selectedEvent.label}
          selectedOptions={[selectedEvent.eventKey]}
          onOptionSelect={(_, data) =>
            changeStep({ ...step, config: { ...step.config, eventKey: data.optionValue ?? selectedEvent.eventKey } })
          }
        >
          {events.map((event) => (
            <Option key={event.eventKey} value={event.eventKey}>
              {event.label}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {provider === "linear" && (
        <ProviderResourcePicker
          step={step}
          provider={provider}
          inventory={inventory}
          capability="team.read"
          changeStep={changeStep}
        />
      )}
    </ProviderState>
  )
}

function ScheduleInspector({ step, changeStep }: { step: WorkflowStep; changeStep: ProviderChangeStep }) {
  const interval = typeof step.config.intervalSeconds === "number" ? step.config.intervalSeconds : 300
  const cron = typeof step.config.cron === "string" ? step.config.cron : ""
  return (
    <>
      <Field label="Schedule mode">
        <Dropdown
          value={cron === "" ? "Interval" : "CRON"}
          selectedOptions={[cron === "" ? "interval" : "cron"]}
          onOptionSelect={(_, data) => {
            if (data.optionValue === "cron") {
              changeStep({ ...step, config: { timezone: step.config.timezone ?? "UTC", cron: "0 9 * * 1-5" } })
            } else {
              changeStep({ ...step, config: { timezone: step.config.timezone ?? "UTC", intervalSeconds: interval } })
            }
          }}
        >
          <Option value="interval">Interval</Option>
          <Option value="cron">CRON</Option>
        </Dropdown>
      </Field>
      {cron === "" ? (
        <Field label="Interval seconds">
          <Input
            type="number"
            min={10}
            value={String(interval)}
            onChange={(_, data) => {
              const intervalSeconds = Number(data.value)
              if (Number.isInteger(intervalSeconds) && intervalSeconds >= 10) {
                changeStep({ ...step, config: { ...step.config, intervalSeconds } })
              }
            }}
          />
        </Field>
      ) : (
        <Field label="CRON expression">
          <Input
            value={cron}
            onChange={(_, data) => changeStep({ ...step, config: { ...step.config, cron: data.value } })}
          />
        </Field>
      )}
      <Field label="Timezone">
        <Input
          value={typeof step.config.timezone === "string" ? step.config.timezone : "UTC"}
          onChange={(_, data) => changeStep({ ...step, config: { ...step.config, timezone: data.value } })}
        />
      </Field>
    </>
  )
}

function useProviderInventory() {
  const [inventory, setInventory] = useState<RepositoryInventoryItem[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void getIntegrationResourceInventory()
      .then(({ resources }) => {
        if (active) {
          setInventory(resources.filter(({ resource }) => !resource.stale))
          setState("ready")
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Provider resources could not be loaded")
          setState("error")
        }
      })
    return () => {
      active = false
    }
  }, [])
  return { inventory, state, error }
}

function useProviderEvents() {
  const [events, setEvents] = useState<IntegrationProviderEvent[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void listIntegrationProviderEvents()
      .then((result) => {
        if (active) {
          setEvents(result)
          setState("ready")
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Provider events could not be loaded")
          setState("error")
        }
      })
    return () => {
      active = false
    }
  }, [])
  return { events, state, error }
}

function useProviderOperations() {
  const [operations, setOperations] = useState<ProviderOperation[]>([])
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void listProviderOperations()
      .then((result) => {
        if (active) {
          setOperations(result)
          setState("ready")
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "Provider operations could not be loaded")
          setState("error")
        }
      })
    return () => {
      active = false
    }
  }, [])
  return { operations, state, error }
}

function ProviderState({
  state,
  error,
  inventory,
  children
}: {
  state: "loading" | "ready" | "error"
  error: string
  inventory: RepositoryInventoryItem[]
  children: ReactNode
}) {
  if (state === "loading") {
    return <Spinner size="tiny" label="Loading provider resources" />
  }
  if (state === "error") {
    return <Caption1>{error}</Caption1>
  }
  if (inventory.length === 0) {
    return <Caption1>No connected provider resources are available.</Caption1>
  }
  return children
}

function ProviderResourcePicker({
  step,
  provider,
  inventory,
  capability,
  changeStep
}: {
  step: WorkflowStep
  provider: "github" | "linear"
  inventory: RepositoryInventoryItem[]
  capability: string
  changeStep: ProviderChangeStep
}) {
  const binding = step.config.binding
  const selectedName =
    binding !== null && typeof binding === "object" && !Array.isArray(binding) && typeof binding.name === "string"
      ? binding.name
      : ""
  const available = inventory.filter(
    (item) =>
      item.provider === provider &&
      item.resource.capabilities.includes(
        capability as IntegrationResourceInventory["resources"][number]["resource"]["capabilities"][number]
      )
  )
  if (available.length === 0) {
    return (
      <Caption1>
        No connected {provider === "github" ? "repositories" : "teams"} grant {capability}.
      </Caption1>
    )
  }
  return (
    <Field label={provider === "github" ? "Repository" : "Team"}>
      <Dropdown
        placeholder="Select a connected resource"
        value={selectedName}
        selectedOptions={selectedName === "" ? [] : [selectedName]}
        onOptionSelect={(_, data) => {
          const item = available.find(({ resource }) => resource.name === data.optionValue)
          if (item === undefined) {
            return
          }
          const nextBinding: ResourceBinding = {
            connectionId: item.connectionId,
            provider: item.provider,
            resourceType: item.resource.resourceType,
            externalId: item.resource.externalId,
            name: item.resource.name,
            capabilities: item.resource.capabilities
          }
          changeStep({ ...step, config: { ...step.config, binding: nextBinding } }, nextBinding)
        }}
      >
        {available.map((item) => (
          <Option key={`${item.connectionId}-${item.resource.externalId}`} value={item.resource.name}>
            {item.resource.name}
          </Option>
        ))}
      </Dropdown>
    </Field>
  )
}

function ProviderStepInspector({
  mode,
  step,
  repository,
  changeStep
}: {
  mode: "read" | "write"
  step: WorkflowStep
  repository: ResourceBinding | undefined
  changeStep: ProviderChangeStep
}) {
  const inventoryState = useProviderInventory()
  const operationState = useProviderOperations()
  const provider = step.config.provider === "linear" ? "linear" : "github"
  const operations = operationState.operations.filter(
    (operation) => operation.mode === mode && operation.provider === provider
  )
  const operationId =
    typeof step.config.operation === "string" ? step.config.operation : (operations[0]?.operation ?? "")
  const operation = operations.find((candidate) => candidate.operation === operationId) ?? operations[0]
  let state: "loading" | "ready" | "error" = "ready"
  if (inventoryState.state === "loading" || operationState.state === "loading") {
    state = "loading"
  }
  if (inventoryState.state === "error" || operationState.state === "error") {
    state = "error"
  }
  const error = inventoryState.error || operationState.error
  return (
    <ProviderState state={state} error={error} inventory={inventoryState.inventory}>
      <Field label="Provider">
        <Dropdown
          value={provider === "github" ? "GitHub" : "Linear"}
          selectedOptions={[provider]}
          onOptionSelect={(_, data) => {
            const next = data.optionValue === "linear" ? "linear" : "github"
            const nextOperation = operationState.operations.find(
              (candidate) => candidate.mode === mode && candidate.provider === next
            )
            const binding = next === "github" ? repository : undefined
            changeStep(
              {
                ...step,
                config: {
                  provider: next,
                  operation: nextOperation?.operation ?? "",
                  ...(binding === undefined ? {} : { binding })
                }
              },
              null
            )
          }}
        >
          <Option value="github">GitHub</Option>
          <Option value="linear">Linear</Option>
        </Dropdown>
      </Field>
      <Field label="Operation">
        <Dropdown
          value={operation?.label ?? ""}
          selectedOptions={operation === undefined ? [] : [operation.operation]}
          onOptionSelect={(_, data) => {
            const selected = operations.find((candidate) => candidate.operation === data.optionValue)
            if (selected !== undefined) {
              changeStep(
                {
                  ...step,
                  config: {
                    provider,
                    operation: selected.operation,
                    ...(provider === "github" && repository !== undefined ? { binding: repository } : {})
                  }
                },
                null
              )
            }
          }}
        >
          {operations.map((item) => (
            <Option key={item.operation} value={item.operation}>
              {item.label}
            </Option>
          ))}
        </Dropdown>
      </Field>
      {operation !== undefined && provider === "linear" && (
        <ProviderResourcePicker
          step={step}
          provider={provider}
          inventory={inventoryState.inventory}
          capability={operation.capability}
          changeStep={changeStep}
        />
      )}
      {mode === "write" && (
        <Caption1>
          Agency records the external change before it runs. If the result is unknown, retries pause until you confirm
          what happened.
        </Caption1>
      )}
    </ProviderState>
  )
}
