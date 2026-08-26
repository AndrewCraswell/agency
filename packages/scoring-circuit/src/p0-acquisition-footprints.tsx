import { Fragment, type ReactElement } from "react"

type FootprintProps = {
  readonly name: string
  readonly pcbRotation?: number
  readonly pcbX?: number
  readonly pcbY?: number
}

type Pad = {
  readonly pin: number
  readonly name: string
  readonly xMm: number
  readonly yMm: number
  readonly widthMm: number
  readonly heightMm: number
  readonly solderMaskMarginMm: number
  readonly solderPasteMarginMm: number
}

type FootprintGeometry = {
  readonly package: string
  readonly packageEnvelope: { readonly widthMm: number; readonly heightMm: number }
  readonly padPitchMm: number
  readonly padRowSpanMm: number
  readonly pads: readonly Pad[]
  readonly courtyard: { readonly widthMm: number; readonly heightMm: number }
  readonly orientation: string
  readonly source: {
    readonly authority: "manufacturer-primary"
    readonly url: string
    readonly retainedArtifactPath: string | null
    readonly retainedSha256: string | null
    readonly document?: string
    readonly pageCount?: number
    readonly reviewedPdfPages?: readonly number[]
    readonly pagePurposes?: Readonly<Record<string, string>>
    readonly evidenceGap?: string
  }
}

const tssopPadPositions = [
  { pin: 1, xMm: -2.9, yMm: 2.275 },
  { pin: 2, xMm: -2.9, yMm: 1.625 },
  { pin: 3, xMm: -2.9, yMm: 0.975 },
  { pin: 4, xMm: -2.9, yMm: 0.325 },
  { pin: 5, xMm: -2.9, yMm: -0.325 },
  { pin: 6, xMm: -2.9, yMm: -0.975 },
  { pin: 7, xMm: -2.9, yMm: -1.625 },
  { pin: 8, xMm: -2.9, yMm: -2.275 },
  { pin: 9, xMm: 2.9, yMm: -2.275 },
  { pin: 10, xMm: 2.9, yMm: -1.625 },
  { pin: 11, xMm: 2.9, yMm: -0.975 },
  { pin: 12, xMm: 2.9, yMm: -0.325 },
  { pin: 13, xMm: 2.9, yMm: 0.325 },
  { pin: 14, xMm: 2.9, yMm: 0.975 },
  { pin: 15, xMm: 2.9, yMm: 1.625 },
  { pin: 16, xMm: 2.9, yMm: 2.275 }
] as const

const tmuxPinNames = [
  "A0",
  "EN",
  "NC",
  "S1",
  "S2",
  "S3",
  "S4",
  "D",
  "S8",
  "S7",
  "S6",
  "S5",
  "APP_3V3",
  "SCORING_SGND",
  "A2",
  "A1"
] as const
const hcsPinNames = [
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "Q5",
  "Q6",
  "Q7",
  "APP_GND",
  "SERIAL_OUT",
  "APP_RESET_N",
  "APP_SPI_SCK",
  "SOURCE_LATCH",
  "SOURCE_OE_N",
  "SERIAL_IN",
  "Q0",
  "APP_3V3"
] as const

const tmuxPads: readonly Pad[] = tssopPadPositions.map(({ pin, xMm, yMm }) => ({
  pin,
  name: tmuxPinNames[pin - 1],
  xMm,
  yMm,
  widthMm: 1.5,
  heightMm: 0.45,
  solderMaskMarginMm: 0.05,
  solderPasteMarginMm: 0
}))

const hcsPads: readonly Pad[] = tssopPadPositions.map(({ pin, xMm, yMm }) => ({
  pin,
  name: hcsPinNames[pin - 1],
  xMm,
  yMm,
  widthMm: 1.5,
  heightMm: 0.45,
  solderMaskMarginMm: 0.05,
  solderPasteMarginMm: 0
}))

const adsPads: readonly Pad[] = [
  {
    pin: 1,
    name: "REF_2V5",
    xMm: -2.2,
    yMm: -1,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  },
  {
    pin: 2,
    name: "AVDD_3V3",
    xMm: -2.2,
    yMm: -0.5,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  },
  {
    pin: 3,
    name: "AINP",
    xMm: -2.2,
    yMm: 0,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  },
  {
    pin: 4,
    name: "AINN",
    xMm: -2.2,
    yMm: 0.5,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  },
  {
    pin: 5,
    name: "SCORING_SGND",
    xMm: -2.2,
    yMm: 1,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  },
  {
    pin: 6,
    name: "SAR_CONVST",
    xMm: 2.2,
    yMm: 1,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  },
  {
    pin: 7,
    name: "SAR_DOUT",
    xMm: 2.2,
    yMm: 0.5,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  },
  {
    pin: 8,
    name: "SAR_SCLK",
    xMm: 2.2,
    yMm: 0,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  },
  {
    pin: 9,
    name: "SAR_DIN",
    xMm: 2.2,
    yMm: -0.5,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  },
  {
    pin: 10,
    name: "DVDD_3V3",
    xMm: 2.2,
    yMm: -1,
    widthMm: 1.45,
    heightMm: 0.3,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: 0
  }
]

const soic8Pads: readonly Pad[] = [
  {
    pin: 1,
    name: "DNC",
    xMm: -2.7,
    yMm: 1.905,
    widthMm: 1.55,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 2,
    name: "VIN",
    xMm: -2.7,
    yMm: 0.635,
    widthMm: 1.55,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 3,
    name: "TEMP",
    xMm: -2.7,
    yMm: -0.635,
    widthMm: 1.55,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 4,
    name: "SCORING_SGND",
    xMm: -2.7,
    yMm: -1.905,
    widthMm: 1.55,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 5,
    name: "TRIM_NR",
    xMm: 2.7,
    yMm: -1.905,
    widthMm: 1.55,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 6,
    name: "VREF_2V5",
    xMm: 2.7,
    yMm: -0.635,
    widthMm: 1.55,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 7,
    name: "NC",
    xMm: 2.7,
    yMm: 0.635,
    widthMm: 1.55,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 8,
    name: "DNC",
    xMm: 2.7,
    yMm: 1.905,
    widthMm: 1.55,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  }
]

const adaPads: readonly Pad[] = [
  {
    pin: 1,
    name: "NC_1",
    xMm: -1.905,
    yMm: -2.465,
    widthMm: 0.53,
    heightMm: 1.98,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  },
  {
    pin: 2,
    name: "INVERTING",
    xMm: -0.635,
    yMm: -2.465,
    widthMm: 0.53,
    heightMm: 1.98,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  },
  {
    pin: 3,
    name: "INPUT",
    xMm: 0.635,
    yMm: -2.465,
    widthMm: 0.53,
    heightMm: 1.98,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  },
  {
    pin: 4,
    name: "VNEG_ANALOG",
    xMm: 1.905,
    yMm: -2.465,
    widthMm: 0.53,
    heightMm: 1.98,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  },
  {
    pin: 5,
    name: "NC_5",
    xMm: 1.905,
    yMm: 2.465,
    widthMm: 0.53,
    heightMm: 1.98,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  },
  {
    pin: 6,
    name: "OUTPUT",
    xMm: 0.635,
    yMm: 2.465,
    widthMm: 0.53,
    heightMm: 1.98,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  },
  {
    pin: 7,
    name: "V5_ANALOG",
    xMm: -0.635,
    yMm: 2.465,
    widthMm: 0.53,
    heightMm: 1.98,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  },
  {
    pin: 8,
    name: "NC_8",
    xMm: -1.905,
    yMm: 2.465,
    widthMm: 0.53,
    heightMm: 1.98,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  }
]

const tpsPads: readonly Pad[] = [
  {
    pin: 1,
    name: "VNEG_ANALOG",
    xMm: -1.3,
    yMm: 0.95,
    widthMm: 1.1,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 2,
    name: "V5_ANALOG",
    xMm: -1.3,
    yMm: 0,
    widthMm: 1.1,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 3,
    name: "CFLY_NEG",
    xMm: -1.3,
    yMm: -0.95,
    widthMm: 1.1,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 4,
    name: "SCORING_SGND",
    xMm: 1.3,
    yMm: -0.95,
    widthMm: 1.1,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 5,
    name: "CFLY_POS",
    xMm: 1.3,
    yMm: 0.95,
    widthMm: 1.1,
    heightMm: 0.6,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  }
]

const tpdPinNames = [
  "LINE_1",
  "LINE_2",
  "SCORING_SGND_3",
  "LINE_3",
  "LINE_4",
  "NC_6",
  "NC_7",
  "SCORING_SGND_8",
  "NC_9",
  "NC_10"
] as const

const tpdPads: readonly Pad[] = [
  {
    pin: 1,
    name: tpdPinNames[0],
    xMm: -0.4175,
    yMm: -1,
    widthMm: 0.565,
    heightMm: 0.2,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 2,
    name: tpdPinNames[1],
    xMm: -0.4175,
    yMm: -0.5,
    widthMm: 0.565,
    heightMm: 0.2,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 3,
    name: tpdPinNames[2],
    xMm: -0.4175,
    yMm: 0,
    widthMm: 0.565,
    heightMm: 0.4,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: -0.02
  },
  {
    pin: 4,
    name: tpdPinNames[3],
    xMm: -0.4175,
    yMm: 0.5,
    widthMm: 0.565,
    heightMm: 0.2,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 5,
    name: tpdPinNames[4],
    xMm: -0.4175,
    yMm: 1,
    widthMm: 0.565,
    heightMm: 0.2,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 6,
    name: tpdPinNames[5],
    xMm: 0.4175,
    yMm: -1,
    widthMm: 0.565,
    heightMm: 0.2,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 7,
    name: tpdPinNames[6],
    xMm: 0.4175,
    yMm: -0.5,
    widthMm: 0.565,
    heightMm: 0.2,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 8,
    name: tpdPinNames[7],
    xMm: 0.4175,
    yMm: 0,
    widthMm: 0.565,
    heightMm: 0.4,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: -0.02
  },
  {
    pin: 9,
    name: tpdPinNames[8],
    xMm: 0.4175,
    yMm: 0.5,
    widthMm: 0.565,
    heightMm: 0.2,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  },
  {
    pin: 10,
    name: tpdPinNames[9],
    xMm: 0.4175,
    yMm: 1,
    widthMm: 0.565,
    heightMm: 0.2,
    solderMaskMarginMm: 0.07,
    solderPasteMarginMm: 0
  }
]

const t521Pads: readonly Pad[] = [
  {
    pin: 1,
    name: "K",
    xMm: -1.45,
    yMm: 0,
    widthMm: 1,
    heightMm: 2.2,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  },
  {
    pin: 2,
    name: "A",
    xMm: 1.45,
    yMm: 0,
    widthMm: 1,
    heightMm: 2.2,
    solderMaskMarginMm: 0.05,
    solderPasteMarginMm: -0.05
  }
]

const pinLabels = {
  tmux: Object.fromEntries(tmuxPinNames.map((name, index) => [`pin${index + 1}`, name])) as Record<string, string>,
  hcs: Object.fromEntries(hcsPinNames.map((name, index) => [`pin${index + 1}`, name])) as Record<string, string>,
  ads: {
    pin1: "REF_2V5",
    pin2: "AVDD_3V3",
    pin3: "AINP",
    pin4: "AINN",
    pin5: "SCORING_SGND",
    pin6: "SAR_CONVST",
    pin7: "SAR_DOUT",
    pin8: "SAR_SCLK",
    pin9: "SAR_DIN",
    pin10: "DVDD_3V3"
  },
  ref: {
    pin1: "DNC",
    pin2: "V5_ANALOG",
    pin3: "TEMP",
    pin4: "SCORING_SGND",
    pin5: "TRIM_NR",
    pin6: "VREF_2V5",
    pin7: "NC",
    pin8: "DNC"
  },
  ada: {
    pin1: "NC_1",
    pin2: "INVERTING",
    pin3: "INPUT",
    pin4: "VNEG_ANALOG",
    pin5: "NC_5",
    pin6: "OUTPUT",
    pin7: "V5_ANALOG",
    pin8: "NC_8"
  },
  tps: { pin1: "VNEG_ANALOG", pin2: "V5_ANALOG", pin3: "CFLY_NEG", pin4: "SCORING_SGND", pin5: "CFLY_POS" },
  tpd: Object.fromEntries(tpdPinNames.map((name, index) => [`pin${index + 1}`, name])) as Record<string, string>
} as const

function renderFootprint(geometry: FootprintGeometry, name: string): ReactElement {
  return (
    <footprint name={`${name}_FOOTPRINT`} originalLayer="top">
      {geometry.pads.map((pad) => (
        <Fragment key={pad.pin}>
          <smtpad
            name={String(pad.pin)}
            pcbX={pad.xMm}
            pcbY={pad.yMm}
            shape="rect"
            solderMaskMargin={`${pad.solderMaskMarginMm}mm`}
            solderPasteMargin={`${pad.solderPasteMarginMm}mm`}
            width={`${pad.widthMm}mm`}
            height={`${pad.heightMm}mm`}
            portHints={[String(pad.pin), pad.name, pad.pin === 1 ? "pin1" : `pin${pad.pin}`]}
          />
        </Fragment>
      ))}
      <courtyardrect
        pcbX={0}
        pcbY={0}
        width={`${geometry.courtyard.widthMm}mm`}
        height={`${geometry.courtyard.heightMm}mm`}
        strokeWidth="0.05mm"
      />
    </footprint>
  )
}

const tmuxGeometry: FootprintGeometry = {
  package: "PW TSSOP-16",
  packageEnvelope: { widthMm: 5.1, heightMm: 4.5 },
  padPitchMm: 0.65,
  padRowSpanMm: 5.8,
  pads: tmuxPads,
  courtyard: { widthMm: 7.8, heightMm: 5.6 },
  orientation: "TI PW top view: pin 1 is upper-left; pins 1-8 descend on the left and 9-16 ascend on the right.",
  source: {
    authority: "manufacturer-primary",
    url: "https://www.ti.com/lit/ds/symlink/tmux1208.pdf",
    retainedArtifactPath: "packages/scoring-circuit/docs/evidence/p0-06/ti-tmux1208-scds389c-rev-c.pdf",
    retainedSha256: "C2683E83F693C8D94472063003F391C52F5390BD44F558F1CE18079C615B10D3",
    document: "SCDS389C Rev C",
    pageCount: 37,
    reviewedPdfPages: [3, 34, 35],
    pagePurposes: {
      pinMapAndFunctions: "3",
      packageOutline: "34",
      pwLandPattern: "35"
    }
  }
}

const hcsGeometry: FootprintGeometry = {
  package: "PW TSSOP-16",
  packageEnvelope: { widthMm: 5.1, heightMm: 4.5 },
  padPitchMm: 0.65,
  padRowSpanMm: 5.8,
  pads: hcsPads,
  courtyard: { widthMm: 7.8, heightMm: 5.6 },
  orientation: "TI PW top view: pin 1 is upper-left; pins 1-8 descend on the left and 9-16 ascend on the right.",
  source: {
    authority: "manufacturer-primary",
    url: "https://www.ti.com/lit/ds/symlink/sn74hcs595.pdf",
    retainedArtifactPath: "packages/scoring-circuit/docs/evidence/p0-06/ti-sn74hcs595-scls803b-rev-b.pdf",
    retainedSha256: "6B173EC05957620F336AD80DCF344B558A53BBDF7764AB349B6DBE27ADDA6E88",
    document: "SCLS803B Rev B",
    pageCount: 34,
    reviewedPdfPages: [3, 31, 32],
    pagePurposes: {
      pinMapAndFunctions: "3",
      packageOutline: "31",
      pwLandPattern: "32"
    }
  }
}

const tpdGeometry: FootprintGeometry = {
  package: "DQA0010A USON-10",
  packageEnvelope: { widthMm: 1.1, heightMm: 2.6 },
  padPitchMm: 0.5,
  padRowSpanMm: 0.835,
  pads: tpdPads,
  courtyard: { widthMm: 1.9, heightMm: 3.1 },
  orientation:
    "TI DQA0010A top view: pin 1 is upper-left; pins 1-5 descend on the left and pins 6-10 ascend on the right. Board rotation is zero degrees.",
  source: {
    authority: "manufacturer-primary",
    url: "https://www.ti.com/lit/ds/symlink/tpd4e05u06.pdf",
    retainedArtifactPath: "packages/scoring-circuit/docs/evidence/bp-031/ti-tpd4e05u06-dqar-datasheet.pdf",
    retainedSha256: "C167CF1E72A5473A4D2C59B6A3C0251498701DA05B7785919B9CEAAE3B3E02C6",
    document: "TPDxE05U06 Rev O",
    reviewedPdfPages: [4, 20, 28, 29, 30, 37],
    pagePurposes: {
      pinMapAndFunctions: "4",
      exactOrderableAndPackage: "20, 37",
      dqaOutlineLandPatternAndStencil: "28-30"
    }
  }
}

const t521Geometry: FootprintGeometry = {
  package: "1411 / 3528 B case",
  packageEnvelope: { widthMm: 3.7, heightMm: 3 },
  padPitchMm: 2.9,
  padRowSpanMm: 2.9,
  pads: t521Pads,
  courtyard: { widthMm: 4.2, heightMm: 3.3 },
  orientation:
    "KEMET page 1 end views establish cathode-negative K and anode-positive A. Project top view places K on pad 1 at left and A on pad 2 at right; verify polarity marking and assembly rotation independently.",
  source: {
    authority: "manufacturer-primary",
    url: "https://search.kemet.com/download/specsheet/T521B106M025ATE100",
    retainedArtifactPath: "packages/scoring-circuit/docs/evidence/m4-04/kemet-t521b106m025ate100-datasheet.pdf",
    retainedSha256: "8DBB07C110359B8BC1BE5AE0044E08B8BADCC88A60F4DA36404BB27803F85EBD",
    document: "KEMET T521 1411/3528 B case specification",
    pageCount: 1,
    reviewedPdfPages: [1],
    pagePurposes: {
      packagePolarityAndDimensions: "1"
    },
    evidenceGap:
      "The retained manufacturer drawing does not publish a PCB land pattern or manufacturer CAD; the project land is review-only."
  }
}

const adsGeometry: FootprintGeometry = {
  package: "DGS VSSOP-10",
  packageEnvelope: { widthMm: 5.05, heightMm: 3.1 },
  padPitchMm: 0.5,
  padRowSpanMm: 4.4,
  pads: adsPads,
  courtyard: { widthMm: 6.35, heightMm: 3.6 },
  orientation: "TI DGS top view: pin 1 is upper-left; pins 1-5 descend on the left and pins 6-10 ascend on the right.",
  source: {
    authority: "manufacturer-primary",
    url: "https://www.ti.com/lit/ds/symlink/ads8881.pdf",
    retainedArtifactPath:
      "packages/scoring-circuit/docs/evidence/bp-031/texas-instruments-ads8881-dgs-datasheet-rev-d.pdf",
    retainedSha256: "EA5896CA4C8053A1AE183BE8354DD551A5D947CE670AC1F1170C59176148F1A8"
  }
}

const refGeometry: FootprintGeometry = {
  package: "D SOIC-8",
  packageEnvelope: { widthMm: 5, heightMm: 3.98 },
  padPitchMm: 1.27,
  padRowSpanMm: 5.4,
  pads: soic8Pads,
  courtyard: { widthMm: 7.45, heightMm: 5.5 },
  orientation:
    "TI D SOIC top view: pin 1 is upper-left; pins 1-4 descend on the left and pins 5-8 ascend on the right.",
  source: {
    authority: "manufacturer-primary",
    url: "https://www.ti.com/lit/gpn/REF5025A-Q1",
    retainedArtifactPath:
      "packages/scoring-circuit/docs/evidence/bp-031/ti-ref50xxa-q1-ref5025aqdrq1-datasheet-rev-h.pdf",
    retainedSha256: "908E1BB3275E2398DF8FAD130DAD91D524C6E5C413967F58229348DD2BCED68B",
    evidenceGap:
      "The retained REF5025A-Q1 source identifies the exact SOIC package but does not publish a dedicated PCB land pattern or exact manufacturer CAD; project geometry remains review-only."
  }
}

const adaGeometry: FootprintGeometry = {
  package: "R-8 SOIC_N",
  packageEnvelope: { widthMm: 5, heightMm: 4 },
  padPitchMm: 1.27,
  padRowSpanMm: 4.93,
  pads: adaPads,
  courtyard: { widthMm: 5.5, heightMm: 7.41 },
  orientation:
    "ADI R-8 top view used by the retained review: pin 1 is lower-left; pins 1-4 run left-to-right on the lower row and pins 5-8 return right-to-left on the upper row.",
  source: {
    authority: "manufacturer-primary",
    url: "https://www.analog.com/media/en/technical-documentation/data-sheets/ADA4177-1_4177-2_4177-4.pdf",
    retainedArtifactPath: "packages/scoring-circuit/docs/evidence/bp-031/analog-devices-ada4177-datasheet-rev-e.pdf",
    retainedSha256: "363C6BB4B4DB88F197F4FB3A0D286CD041FB492B9BFD1900382078B1489078CC",
    evidenceGap:
      "The retained land pattern is an ADI S8 family recommendation reconciled to the exact R-8 orderable; acquire exact manufacturer CAD before fabrication."
  }
}

const tpsGeometry: FootprintGeometry = {
  package: "DBV0005A SOT-23-5",
  packageEnvelope: { widthMm: 3.05, heightMm: 1.75 },
  padPitchMm: 0.95,
  padRowSpanMm: 2.6,
  pads: tpsPads,
  courtyard: { widthMm: 4.2, heightMm: 3.55 },
  orientation: "TI DBV top view: pin 1 is upper-left; pins 1-3 descend on the left and pins 4-5 return on the right.",
  source: {
    authority: "manufacturer-primary",
    url: "https://www.ti.com/lit/ds/symlink/tps60400.pdf",
    retainedArtifactPath: "packages/scoring-circuit/docs/evidence/m4-04/ti-tps60400-dbvr-datasheet.pdf",
    retainedSha256: "B3B26A8519549BC369E8A91F11133F1D5CBE37C31EBBDF13C4D4C980EF7B8347"
  }
}

export const p0AcquisitionFootprintEvidence = {
  artifactKind: "p0-acquisition-footprints",
  workUnit: "P0-06",
  placementState: "approved",
  placementReviewer: "root-final-reviewer",
  fabricationAuthority: "deny",
  components: {
    TPD4E05U06DQAR: tpdGeometry,
    TMUX1208PWR: tmuxGeometry,
    SN74HCS595PWR: hcsGeometry,
    ADS8881IDGS: adsGeometry,
    REF5025AQDRQ1: refGeometry,
    "ADA4177-1ARZ": adaGeometry,
    TPS60400DBVR: tpsGeometry
  },
  resistors: {
    sourceAndSink470: {
      manufacturer: "Vishay",
      manufacturerPartNumber: "TNPW0603470RBEEA",
      package: "TNPW0603 e3 / 0603 (1608 metric)",
      resistanceOhms: 470,
      tolerancePercent: 0.1,
      temperatureCoefficientPpmPerK: 25,
      operatingTemperatureC: { minimum: -55, maximum: 175 },
      bodyMm: { length: 1.55, width: 0.85, height: 0.45 },
      footprint: {
        standard: "Vishay Document 28950, IPC-7351 reflow",
        padGapMm: 0.7,
        padWidthMm: 0.9,
        padLengthMm: 1,
        overallLandSpanMm: 2.5
      },
      orientation: "Non-polarized two-terminal chip resistor; either rotation is electrically equivalent.",
      source: {
        authority: "manufacturer-primary",
        url: "https://www.vishay.com/docs/28758/tnpw_e3.pdf",
        retainedArtifactPath: "packages/scoring-circuit/docs/evidence/p0-06/vishay-tnpw-e3-28758-rev-2026-04-10.pdf",
        retainedSha256: "0F988DC24D40D9D1BA25D4DCBC7A818BE2E73D1EEA4F0FD88A5F5E1658723B6A",
        document: "28758 Rev 10-Apr-2026",
        reviewedPdfPages: [3, 5, 14],
        pagePurposes: {
          exactPartNumberEncoding: "4",
          packageDimensions: "14",
          electricalRangeAndTemperature: "3-4"
        },
        padSource: {
          url: "https://www.vishay.com/doc/?28950=",
          retainedArtifactPath:
            "packages/scoring-circuit/docs/evidence/p0-06/vishay-recommended-solder-pad-28950-rev-2022-07-12.pdf",
          retainedSha256: "9E2B145C937DA3BE1E926B8AFC2856959754EEB4D1103241D838038F7308144E",
          document: "28950 Rev 12-Jul-2022",
          reviewedPdfPages: [1],
          pagePurposes: { ipc7351Reflow0603: "1" }
        }
      }
    }
  }
} as const

export function validateP0AcquisitionFootprintEvidence(
  evidence: typeof p0AcquisitionFootprintEvidence = p0AcquisitionFootprintEvidence
): readonly string[] {
  const errors: string[] = []
  for (const [mpn, geometry] of Object.entries(evidence.components)) {
    if (geometry.pads.length === 0 || geometry.courtyard.widthMm <= 0 || geometry.courtyard.heightMm <= 0) {
      errors.push(`${mpn} footprint geometry is empty`)
    }
    if (
      geometry.packageEnvelope.widthMm <= 0 ||
      geometry.packageEnvelope.heightMm <= 0 ||
      geometry.padPitchMm <= 0 ||
      geometry.padRowSpanMm <= 0
    ) {
      errors.push(`${mpn} package geometry is incomplete`)
    }
    if (geometry.pads.some((pad) => pad.widthMm <= 0 || pad.heightMm <= 0 || pad.name.length === 0)) {
      errors.push(`${mpn} has an invalid pad record`)
    }
    if (geometry.source.retainedArtifactPath === null && geometry.source.evidenceGap === undefined) {
      errors.push(`${mpn} lacks retained evidence or an explicit evidence gap`)
    }
  }
  if (evidence.components.TPD4E05U06DQAR.pads.length !== 10) {
    errors.push("TPD4E05U06DQAR footprint must contain 10 pads")
  }
  if (evidence.components.TMUX1208PWR.pads.length !== 16 || evidence.components.SN74HCS595PWR.pads.length !== 16) {
    errors.push("TSSOP phase-control footprints must contain 16 pads")
  }
  if (evidence.components.ADS8881IDGS.pads.length !== 10 || evidence.components.REF5025AQDRQ1.pads.length !== 8) {
    errors.push("shared converter/reference footprints have incorrect pad counts")
  }
  if (evidence.components["ADA4177-1ARZ"].pads.length !== 8 || evidence.components.TPS60400DBVR.pads.length !== 5) {
    errors.push("buffer/negative-rail footprints have incorrect pad counts")
  }
  const resistor = evidence.resistors.sourceAndSink470
  if (
    resistor.manufacturerPartNumber !== "TNPW0603470RBEEA" ||
    resistor.resistanceOhms !== 470 ||
    resistor.tolerancePercent !== 0.1 ||
    resistor.temperatureCoefficientPpmPerK !== 25 ||
    resistor.package !== "TNPW0603 e3 / 0603 (1608 metric)" ||
    resistor.source.retainedArtifactPath === null ||
    resistor.source.padSource.retainedArtifactPath === null
  ) {
    errors.push("source/sink 470 ohm resistor selection or evidence binding is incomplete")
  }
  return errors
}

validateP0AcquisitionFootprintEvidence()

export function P0Tmux1208Footprint({ name, pcbRotation, pcbX, pcbY }: FootprintProps): ReactElement {
  return (
    <chip
      name={name}
      manufacturerPartNumber="TMUX1208PWR"
      pinLabels={pinLabels.tmux}
      footprint={renderFootprint(tmuxGeometry, name)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function P0Tpd4e05u06Footprint({ name, pcbRotation, pcbX, pcbY }: FootprintProps): ReactElement {
  return (
    <chip
      name={name}
      manufacturerPartNumber="TPD4E05U06DQAR"
      pinLabels={pinLabels.tpd}
      footprint={renderFootprint(tpdGeometry, name)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function P0T521BFootprint({ name, pcbRotation, pcbX, pcbY }: FootprintProps): ReactElement {
  return (
    <capacitor
      name={name}
      manufacturerPartNumber="T521B106M025ATE100"
      capacitance="10uF"
      maxVoltageRating="25V"
      polarized
      footprint={renderFootprint(t521Geometry, name)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function P0Sn74Hcs595Footprint({ name, pcbRotation, pcbX, pcbY }: FootprintProps): ReactElement {
  return (
    <chip
      name={name}
      manufacturerPartNumber="SN74HCS595PWR"
      pinLabels={pinLabels.hcs}
      footprint={renderFootprint(hcsGeometry, name)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function P0Ads8881Footprint({ name, pcbRotation, pcbX, pcbY }: FootprintProps): ReactElement {
  return (
    <chip
      name={name}
      manufacturerPartNumber="ADS8881IDGS"
      pinLabels={pinLabels.ads}
      footprint={renderFootprint(adsGeometry, name)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function P0Ref5025Footprint({ name, pcbRotation, pcbX, pcbY }: FootprintProps): ReactElement {
  return (
    <chip
      name={name}
      manufacturerPartNumber="REF5025AQDRQ1"
      pinLabels={pinLabels.ref}
      footprint={renderFootprint(refGeometry, name)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function P0Ada4177Footprint({ name, pcbRotation, pcbX, pcbY }: FootprintProps): ReactElement {
  return (
    <chip
      name={name}
      manufacturerPartNumber="ADA4177-1ARZ"
      pinLabels={pinLabels.ada}
      footprint={renderFootprint(adaGeometry, name)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}

export function P0Tps60400Footprint({ name, pcbRotation, pcbX, pcbY }: FootprintProps): ReactElement {
  return (
    <chip
      name={name}
      manufacturerPartNumber="TPS60400DBVR"
      pinLabels={pinLabels.tps}
      footprint={renderFootprint(tpsGeometry, name)}
      pcbRotation={pcbRotation}
      pcbX={pcbX}
      pcbY={pcbY}
    />
  )
}
