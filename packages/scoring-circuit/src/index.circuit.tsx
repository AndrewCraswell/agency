import { p0BoardPlacement } from "./board-placement.js"
import { prototypeBoardRouting } from "./board-routing.js"
import { Bp034DirectWireWeaponFootprint } from "./bp034-direct-wire-weapon-footprint.js"
import { prototypeCarrierArchitecture } from "./clean-sheet-board-architecture.js"
import { P0DigitalPeripherals } from "./p0-digital-peripherals.circuit.js"
import { P0DisplayPower } from "./p0-display-power.circuit.js"
import { P0Esp32SupportCircuit } from "./p0-esp32-support.circuit.js"
import { P0IrReceiver } from "./p0-ir-receiver.circuit.js"
import { P0PisteLanding } from "./p0-piste-landing.js"
import { P0PrimaryOutputs } from "./p0-primary-outputs.circuit.js"
import { P0SevenLineAcquisition } from "./p0-seven-line-acquisition.circuit.js"
import P0UsbPower from "./p0-usb-power.circuit.js"

function ScoringCircuit() {
  const { board } = prototypeCarrierArchitecture
  const halfWidth = board.widthMm / 2
  const halfHeight = board.heightMm / 2
  const mountingInset = 6

  return (
    <board
      title={prototypeCarrierArchitecture.title}
      width={`${board.widthMm}mm`}
      height={`${board.heightMm}mm`}
      layers={board.layerCount}
      pcbPack={false}
      placementDrcChecksDisabled
      autorouter={prototypeBoardRouting.autorouter}
    >
      <hole name="H1" diameter="3.2mm" pcbX={-halfWidth + mountingInset} pcbY={-halfHeight + mountingInset} />
      <hole name="H2" diameter="3.2mm" pcbX={halfWidth - mountingInset} pcbY={-halfHeight + mountingInset} />
      <hole name="H3" diameter="3.2mm" pcbX={-halfWidth + mountingInset} pcbY={halfHeight - mountingInset} />
      <hole name="H4" diameter="3.2mm" pcbX={halfWidth - mountingInset} pcbY={halfHeight - mountingInset} />

      <copperpour
        name="APP_GND_PLANE"
        layer="inner1"
        connectsTo="net.APP_GND"
        clearance="0.25mm"
        padMargin="0.25mm"
        traceMargin="0.25mm"
        boardEdgeMargin="1mm"
      />
      <autoroutingphase
        name="APP_GND_FANOUT"
        phaseIndex={0}
        autorouter="fanout"
        connection="net.APP_GND"
        fanoutRoutingLayers={["inner1"]}
        fanoutPourNetMap={{ inner1: "net.APP_GND" }}
      />

      <Bp034DirectWireWeaponFootprint {...p0BoardPlacement.islands.weapon} />
      <P0PisteLanding {...p0BoardPlacement.islands.piste} />
      <P0IrReceiver {...p0BoardPlacement.islands.irReceiver} />
      <P0UsbPower {...p0BoardPlacement.islands.usbPower} />
      <P0DisplayPower {...p0BoardPlacement.islands.displayPower} />
      <P0DigitalPeripherals {...p0BoardPlacement.islands.digital} />
      <P0Esp32SupportCircuit {...p0BoardPlacement.islands.esp32} />
      <P0PrimaryOutputs {...p0BoardPlacement.islands.primaryOutputs} />
      <P0SevenLineAcquisition {...p0BoardPlacement.islands.analog} />

      <resistor
        name="R_V5_ANALOG_LINK"
        manufacturerPartNumber="RC0603JR-070RL"
        resistance="0"
        footprint="0603"
        pcbX={-30}
        pcbY={15}
      />
      <resistor
        name="R_SCORING_GROUND_LINK"
        manufacturerPartNumber="RC0603JR-070RL"
        resistance="0"
        footprint="0603"
        pcbX={-24}
        pcbY={15}
      />
      <trace from="net.V5" to="R_V5_ANALOG_LINK.pin1" />
      <trace from="R_V5_ANALOG_LINK.pin2" to="net.V5_ANALOG" />
      <trace from="net.SCORING_SGND" to="R_SCORING_GROUND_LINK.pin1" />
      <trace from="R_SCORING_GROUND_LINK.pin2" to="net.APP_GND" />

      <trace from="J_WEAPON_DIRECT.LEFT_WEAPON_A" to="J_WEAPON_DIRECT.LEFT_WEAPON_A_TEST" />
      <trace from="J_WEAPON_DIRECT.LEFT_WEAPON_A" to="net.LEFT_WEAPON_A" />
      <trace from="J_WEAPON_DIRECT.LEFT_WEAPON_B" to="J_WEAPON_DIRECT.LEFT_WEAPON_B_TEST" />
      <trace from="J_WEAPON_DIRECT.LEFT_WEAPON_B" to="net.LEFT_WEAPON_B" />
      <trace from="J_WEAPON_DIRECT.LEFT_WEAPON_C" to="J_WEAPON_DIRECT.LEFT_WEAPON_C_TEST" />
      <trace from="J_WEAPON_DIRECT.LEFT_WEAPON_C" to="net.LEFT_WEAPON_C" />
      <trace from="J_WEAPON_DIRECT.RIGHT_WEAPON_A" to="J_WEAPON_DIRECT.RIGHT_WEAPON_A_TEST" />
      <trace from="J_WEAPON_DIRECT.RIGHT_WEAPON_A" to="net.RIGHT_WEAPON_A" />
      <trace from="J_WEAPON_DIRECT.RIGHT_WEAPON_B" to="J_WEAPON_DIRECT.RIGHT_WEAPON_B_TEST" />
      <trace from="J_WEAPON_DIRECT.RIGHT_WEAPON_B" to="net.RIGHT_WEAPON_B" />
      <trace from="J_WEAPON_DIRECT.RIGHT_WEAPON_C" to="J_WEAPON_DIRECT.RIGHT_WEAPON_C_TEST" />
      <trace from="J_WEAPON_DIRECT.RIGHT_WEAPON_C" to="net.RIGHT_WEAPON_C" />
      <trace from="J_PISTE_DIRECT.PISTE" to="J_PISTE_DIRECT.PISTE_TEST" />
      <trace from="J_PISTE_DIRECT.PISTE" to="net.PISTE" />
    </board>
  )
}

export default ScoringCircuit
