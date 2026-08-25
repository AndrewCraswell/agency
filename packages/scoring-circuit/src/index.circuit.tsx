import { cleanSheetBoardArchitecture } from "./clean-sheet-board-architecture.js"

function ScoringCircuit() {
  const { board } = cleanSheetBoardArchitecture
  const halfWidth = board.provisionalWidthMm / 2
  const halfHeight = board.provisionalHeightMm / 2
  const mountingInset = 6

  return (
    <board
      title={`${board.title} ${cleanSheetBoardArchitecture.revision}`}
      width={`${board.provisionalWidthMm}mm`}
      height={`${board.provisionalHeightMm}mm`}
      layers={board.layerCount}
    >
      <hole name="H1" diameter="3.2mm" pcbX={-halfWidth + mountingInset} pcbY={-halfHeight + mountingInset} />
      <hole name="H2" diameter="3.2mm" pcbX={halfWidth - mountingInset} pcbY={-halfHeight + mountingInset} />
      <hole name="H3" diameter="3.2mm" pcbX={-halfWidth + mountingInset} pcbY={halfHeight - mountingInset} />
      <hole name="H4" diameter="3.2mm" pcbX={halfWidth - mountingInset} pcbY={halfHeight - mountingInset} />
    </board>
  )
}

export default ScoringCircuit
