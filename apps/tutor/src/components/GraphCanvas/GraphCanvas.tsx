import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useNodesState,
  type NodeMouseHandler,
  type NodeTypes,
  type OnInit,
  type OnMove,
  type OnNodeDrag
} from "@xyflow/react"
import { memo, useEffect } from "react"
import type { KnowledgeEdge, KnowledgeNode } from "@/graph/graphTypes"
import { GraphHighlightContext } from "./GraphHighlightContext"

type GraphCanvasProps = {
  className: string
  mode: "explore" | "guided"
  nodes: readonly KnowledgeNode[]
  edges: KnowledgeEdge[]
  nodeTypes: NodeTypes
  onInit: OnInit<KnowledgeNode, KnowledgeEdge>
  onMove: OnMove
  onNodeClick: NodeMouseHandler<KnowledgeNode>
  onNodeDragStop: OnNodeDrag<KnowledgeNode>
  onPaneClick: () => void
  onMoveEnd: OnMove
  highlightedNodeIds?: ReadonlySet<string>
}

function GraphCanvasComponent({
  className,
  mode,
  nodes,
  edges,
  nodeTypes,
  onInit,
  onMove,
  onNodeClick,
  onNodeDragStop,
  onPaneClick,
  onMoveEnd,
  highlightedNodeIds
}: GraphCanvasProps) {
  const [interactiveNodes, setInteractiveNodes, onNodesChange] = useNodesState<KnowledgeNode>([...nodes])

  useEffect(() => {
    setInteractiveNodes([...nodes])
  }, [nodes, setInteractiveNodes])

  return (
    <GraphHighlightContext value={highlightedNodeIds}>
      <ReactFlow<KnowledgeNode, KnowledgeEdge>
        className={className}
        nodes={interactiveNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onInit={onInit}
        onMove={onMove}
        onNodeClick={onNodeClick}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        fitView={mode === "guided"}
        fitViewOptions={{ padding: mode === "explore" ? 0.06 : 0.12 }}
        defaultViewport={mode === "explore" ? { x: 28, y: 28, zoom: 0.72 } : undefined}
        onlyRenderVisibleElements={mode === "explore"}
        nodesDraggable
        nodesConnectable={false}
        deleteKeyCode={null}
        zoomOnDoubleClick={false}
        minZoom={mode === "explore" ? 0.01 : 0.35}
        maxZoom={1.6}
        onMoveEnd={onMoveEnd}
        aria-label="Interactive mathematics skills graph"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </GraphHighlightContext>
  )
}

export const GraphCanvas = memo(GraphCanvasComponent)
