import { createContext, useContext } from "react"

export const GraphHighlightContext = createContext<ReadonlySet<string> | undefined>(undefined)

export function useIsGraphNodeHighlighted(nodeId: string, isResource: boolean) {
  const highlightedNodeIds = useContext(GraphHighlightContext)
  return highlightedNodeIds === undefined || isResource || highlightedNodeIds.has(nodeId)
}
