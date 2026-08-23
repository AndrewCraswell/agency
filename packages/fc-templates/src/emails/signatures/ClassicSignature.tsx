/*
 * The classic signature: a full-height shield, a hairline, then the name with the socials up top and
 * the four contact lines stacked under it. The one that reads as a conventional signature.
 *
 * Rendered by React Email into email-safe HTML — every box is a table cell, every colour is inline,
 * the glyphs are inline PNGs, and the light/dark swap is carried by the shell's `dk-` classes.
 */

import { Column, Container, Row } from "react-email"
import { color, font } from "../components/tokens.ts"
import { signatory } from "./signatureData.ts"
import { ContactRow, SignatureLogo, Socials, SignatureShell } from "./signatureShell.tsx"

const contact = { fontSize: 13, gap: 8, iconSize: 14 } as const

const ClassicSignature = () => (
  <SignatureShell title="Fencing Club — Classic signature">
    <Container style={{ margin: 0, maxWidth: 470, width: 470 }}>
      <Row>
        <Column style={{ paddingRight: 20, verticalAlign: "middle", width: 110 }}>
          <SignatureLogo height={134} />
        </Column>
        <Column style={{ verticalAlign: "middle", width: 1 }}>
          <div
            className="dk-hairline"
            style={{ backgroundColor: color.line, fontSize: 0, height: 120, lineHeight: 0, width: 1 }}
          />
        </Column>
        <Column style={{ paddingLeft: 20, verticalAlign: "middle" }}>
          <Row>
            <Column style={{ verticalAlign: "top" }}>
              <div
                className="dk-text"
                style={{
                  color: color.ink,
                  fontFamily: font.display,
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: -0.3,
                  lineHeight: "24px"
                }}
              >
                {signatory.name}
              </div>
              <div
                className="dk-muted"
                style={{ color: color.inkSoft, fontFamily: font.body, fontSize: 13, lineHeight: "18px", paddingTop: 2 }}
              >
                {signatory.title}
              </div>
            </Column>
            <Column style={{ paddingLeft: 16, textAlign: "right", verticalAlign: "top", width: 60 }}>
              <Socials gap={12} size={16} style={{ marginLeft: "auto" }} />
            </Column>
          </Row>
          <div style={{ paddingTop: 12 }}>
            <ContactRow {...contact} href={`mailto:${signatory.email}`} icon="mail">
              {signatory.email}
            </ContactRow>
            <ContactRow {...contact} href={signatory.website.href} icon="globe" topGap={6}>
              {signatory.website.label}
            </ContactRow>
            <ContactRow {...contact} href={signatory.phone.href} icon="phone" topGap={6}>
              {signatory.phone.label}
            </ContactRow>
            <ContactRow {...contact} icon="mapPin" topGap={6}>
              {signatory.location}
            </ContactRow>
          </div>
        </Column>
      </Row>
    </Container>
  </SignatureShell>
)

export default ClassicSignature
