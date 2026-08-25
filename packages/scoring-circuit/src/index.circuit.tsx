import { Bp034DirectWireWeaponFootprint } from "./bp034-direct-wire-weapon-footprint.js"
import { cleanSheetBoardArchitecture } from "./clean-sheet-board-architecture.js"
import { P0DigitalPeripherals } from "./p0-digital-peripherals.circuit.js"
import { P0DisplayPower } from "./p0-display-power.circuit.js"
import { P0Esp32SupportCircuit } from "./p0-esp32-support.circuit.js"
import { P0IrReceiver } from "./p0-ir-receiver.circuit.js"
import { P0PisteLanding } from "./p0-piste-landing.js"
import { P0PrimaryOutputs } from "./p0-primary-outputs.circuit.js"
import { P0SevenLineAcquisition } from "./p0-seven-line-acquisition.circuit.js"
import P0UsbPower from "./p0-usb-power.circuit.js"

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

      <Bp034DirectWireWeaponFootprint pcbX={-halfWidth + 16} pcbY={0} pcbRotation={90} />
      <P0PisteLanding pcbX={-halfWidth + 16} pcbY={halfHeight - 20} />
      <P0IrReceiver pcbX={0} pcbY={halfHeight - 8} />
      <P0UsbPower />
      <P0DisplayPower pcbX={48} pcbY={-40} />
      <P0DigitalPeripherals pcbX={52} pcbY={22} />
      <P0Esp32SupportCircuit pcbX={22} pcbY={-4} />
      <P0PrimaryOutputs pcbX={42} pcbY={45} />
      <P0SevenLineAcquisition pcbX={0} pcbY={0} />

      <trace from="J_WEAPON_DIRECT.LEFT_WEAPON_A" to="J_WEAPON_DIRECT.LEFT_WEAPON_A_TEST" />
      <trace from="J_WEAPON_DIRECT.LEFT_WEAPON_B" to="J_WEAPON_DIRECT.LEFT_WEAPON_B_TEST" />
      <trace from="J_WEAPON_DIRECT.LEFT_WEAPON_C" to="J_WEAPON_DIRECT.LEFT_WEAPON_C_TEST" />
      <trace from="J_WEAPON_DIRECT.RIGHT_WEAPON_A" to="J_WEAPON_DIRECT.RIGHT_WEAPON_A_TEST" />
      <trace from="J_WEAPON_DIRECT.RIGHT_WEAPON_B" to="J_WEAPON_DIRECT.RIGHT_WEAPON_B_TEST" />
      <trace from="J_WEAPON_DIRECT.RIGHT_WEAPON_C" to="J_WEAPON_DIRECT.RIGHT_WEAPON_C_TEST" />
      <trace from="J_PISTE_DIRECT.PISTE" to="J_PISTE_DIRECT.PISTE_TEST" />
    </board>
  )
}

export default ScoringCircuit
