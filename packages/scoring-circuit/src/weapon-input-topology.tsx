type WeaponInputEndpointLabels = {
  readonly a: string
  readonly b: string
  readonly c: string
}

export type WeaponInputTopology = {
  readonly esd: {
    readonly name: string
    readonly manufacturerPartNumber: "TPD4E05U06DQAR"
    readonly pinLabels: {
      readonly pin1: "CH_A"
      readonly pin2: "CH_B"
      readonly pin3: "CH_C"
      readonly pin4: "SPARE"
      readonly pin5: "ESD_RETURN"
    }
  }
  readonly frontend: {
    readonly name: string
    readonly manufacturerPartNumber: "ANALOG-FRONT-END-TBD"
    readonly pinLabels: {
      readonly pin1: "RAW_A"
      readonly pin2: "RAW_B"
      readonly pin3: "RAW_C"
      readonly pin4: "SGND"
      readonly pin5: "S3_3"
      readonly pin6: "SENSE_A"
      readonly pin7: "SENSE_B"
      readonly pin8: "SENSE_C"
    }
  }
  readonly traces: readonly { readonly from: string; readonly to: string }[]
}

/** Shared weapon-input protection topology; board callers retain connector metadata and placement policy. */
export function weaponInputTopology({
  connectorReference,
  connectorEndpointLabels
}: {
  readonly connectorReference: string
  readonly connectorEndpointLabels: WeaponInputEndpointLabels
}): WeaponInputTopology {
  const side = connectorReference.endsWith("_L") ? "L" : connectorReference.endsWith("_R") ? "R" : undefined
  if (side === undefined) throw new RangeError(`Weapon connector reference must end in _L or _R: ${connectorReference}`)

  const esdName = `U_ESD_${side}`
  const frontendName = `U_FRONTEND_${side}`
  return {
    esd: {
      name: esdName,
      manufacturerPartNumber: "TPD4E05U06DQAR",
      pinLabels: { pin1: "CH_A", pin2: "CH_B", pin3: "CH_C", pin4: "SPARE", pin5: "ESD_RETURN" }
    },
    frontend: {
      name: frontendName,
      manufacturerPartNumber: "ANALOG-FRONT-END-TBD",
      pinLabels: {
        pin1: "RAW_A",
        pin2: "RAW_B",
        pin3: "RAW_C",
        pin4: "SGND",
        pin5: "S3_3",
        pin6: "SENSE_A",
        pin7: "SENSE_B",
        pin8: "SENSE_C"
      }
    },
    traces: [
      { from: `${connectorReference}.${connectorEndpointLabels.a}`, to: `${esdName}.CH_A` },
      { from: `${connectorReference}.${connectorEndpointLabels.b}`, to: `${esdName}.CH_B` },
      { from: `${connectorReference}.${connectorEndpointLabels.c}`, to: `${esdName}.CH_C` },
      { from: `${esdName}.CH_A`, to: `${frontendName}.RAW_A` },
      { from: `${esdName}.CH_B`, to: `${frontendName}.RAW_B` },
      { from: `${esdName}.CH_C`, to: `${frontendName}.RAW_C` },
      { from: `${esdName}.ESD_RETURN`, to: "net.ESD_RETURN" },
      { from: `${frontendName}.SGND`, to: "net.SGND" },
      { from: `${frontendName}.S3_3`, to: "net.S3_3" }
    ]
  }
}

export function WeaponInputTraces({ topology }: { readonly topology: WeaponInputTopology }) {
  return (
    <>
      <trace from={topology.traces[0].from} to={topology.traces[0].to} />
      <trace from={topology.traces[1].from} to={topology.traces[1].to} />
      <trace from={topology.traces[2].from} to={topology.traces[2].to} />
      <trace from={topology.traces[3].from} to={topology.traces[3].to} />
      <trace from={topology.traces[4].from} to={topology.traces[4].to} />
      <trace from={topology.traces[5].from} to={topology.traces[5].to} />
      <trace from={topology.traces[6].from} to={topology.traces[6].to} />
      <trace from={topology.traces[7].from} to={topology.traces[7].to} />
      <trace from={topology.traces[8].from} to={topology.traces[8].to} />
    </>
  )
}
