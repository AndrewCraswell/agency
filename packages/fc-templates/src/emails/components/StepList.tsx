import { Assign, binding, If, type LiquidCondition, pathOf, Var } from "@repo/shopify-emails"
import { Fragment, type ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { accentFill, color, font } from "./tokens.ts"

export type StepItem = {
  readonly title: string
  readonly body: ReactNode
}

export type StepListProps = {
  readonly items: readonly StepItem[]
  readonly spacing?: number
}

const stepGap = 18

/* Called rather than declared, because the accent resolves against the live values at render. */
const numeralStyle = () =>
  ({
    backgroundColor: accentFill(),
    borderRadius: 999,
    color: color.onDark,
    fontFamily: font.body,
    fontSize: 13,
    fontWeight: 700,
    height: 28,
    textAlign: "center",
    verticalAlign: "middle",
    width: 28
  }) as const

/*
 * A numbered sequence, for the messages that have to explain an order of operations. The numeral
 * is a table cell rather than an image, so a client that blocks images still shows the count.
 */
export const StepList = ({ items, spacing = 20 }: StepListProps) => (
  <Section style={{ paddingTop: spacing }}>
    {items.map((item, index) => {
      const gap = index === 0 ? 0 : stepGap
      return (
        <Row key={item.title} style={{ borderCollapse: "separate" }}>
          <Column style={{ paddingRight: 14, paddingTop: gap, verticalAlign: "top", width: 28 }}>
            <Row style={{ borderCollapse: "separate", width: 28 }}>
              <Column align="center" className="dk-num" style={numeralStyle()}>
                {index + 1}
              </Column>
            </Row>
          </Column>
          <Column style={{ paddingTop: gap, verticalAlign: "top" }}>
            <div
              className="dk-text"
              style={{ color: color.ink, fontFamily: font.body, fontSize: 15, fontWeight: 700, lineHeight: "20px" }}
            >
              {item.title}
            </div>
            <div
              className="dk-muted"
              style={{
                color: color.inkSoft,
                fontFamily: font.body,
                fontSize: 13,
                fontWeight: 400,
                lineHeight: "20px",
                paddingTop: 3
              }}
            >
              {item.body}
            </div>
          </Column>
        </Row>
      )
    })}
  </Section>
)

export type InstructionItem = {
  /** A stable React key, because the step itself is markup rather than a string. */
  readonly id: string
  readonly body: ReactNode
  /** Omit for a step that always shows; supply one for a step Liquid decides on at send time. */
  readonly when?: LiquidCondition
}

export type InstructionListProps = {
  readonly items: readonly InstructionItem[]
  readonly spacing?: number
}

const instructionStep = binding<number>("instruction_step")

/*
 * What to do, in order. Unlike `StepList` the count is kept in Liquid, because a step that drops
 * out at send time must not leave a gap in the numbering. Every step carries the same top padding
 * for the same reason: which one renders first is not known here.
 */
export const InstructionList = ({ items, spacing = 20 }: InstructionListProps) => (
  <Section style={{ paddingTop: Math.max(0, spacing - stepGap) }}>
    <Assign to={instructionStep} value="0" />
    {items.map((item) => {
      const step = (
        <>
          <Assign to={instructionStep} value={`${pathOf(instructionStep)} | plus: 1`} />
          <Row style={{ borderCollapse: "separate" }}>
            <Column style={{ paddingRight: 14, paddingTop: stepGap, verticalAlign: "top", width: 28 }}>
              <Row style={{ borderCollapse: "separate", width: 28 }}>
                <Column align="center" className="dk-num" style={numeralStyle()}>
                  <Var path={instructionStep} />
                </Column>
              </Row>
            </Column>
            <Column style={{ paddingTop: stepGap, verticalAlign: "top" }}>
              <div
                className="dk-muted"
                style={{
                  color: color.inkSoft,
                  fontFamily: font.body,
                  fontSize: 14,
                  fontWeight: 400,
                  lineHeight: "21px"
                }}
              >
                {item.body}
              </div>
            </Column>
          </Row>
        </>
      )
      return item.when === undefined ? (
        <Fragment key={item.id}>{step}</Fragment>
      ) : (
        <If key={item.id} test={item.when}>
          {step}
        </If>
      )
    })}
  </Section>
)
