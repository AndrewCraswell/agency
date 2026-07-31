import { Column, Img, Row, Section } from "react-email"
import { color, font, gutter, logoUrl } from "./tokens.ts"

export type EmailHeaderProps = {
  /** The small caps line under the wordmark that says which message this is. */
  readonly eyebrow: string
}

export const EmailHeader = ({ eyebrow }: EmailHeaderProps) => (
  <Section
    className="px dk-band"
    style={{ backgroundColor: color.surfaceDark, padding: `24px ${gutter}px`, textAlign: "center" }}
  >
    <Row style={{ margin: "0 auto", width: "auto" }}>
      <Column style={{ paddingRight: 12, verticalAlign: "middle" }}>
        {/* The asset is 104x126, a 2x export, so this is its natural size. */}
        <Img alt="Fencing Club" height={63} src={logoUrl} style={{ border: 0, display: "block" }} width={52} />
      </Column>
      <Column style={{ textAlign: "left", verticalAlign: "middle" }}>
        <div
          style={{
            color: color.onDark,
            fontFamily: font.display,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 3,
            lineHeight: "22px"
          }}
        >
          FENCING CLUB
        </div>
        <div
          style={{
            color: color.onDarkSoft,
            fontFamily: font.body,
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: 1.5,
            lineHeight: "14px",
            paddingTop: 2
          }}
        >
          {eyebrow}
        </div>
      </Column>
    </Row>
  </Section>
)
