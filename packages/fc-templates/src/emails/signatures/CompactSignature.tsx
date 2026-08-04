/*
 * The compact signature: the same shield, but the block on the right is denser — name and socials
 * over a hairline, then the four facts in two columns. Built for tight inboxes.
 *
 * Rendered by React Email into email-safe HTML: table cells for layout, inline colours, inline PNG
 * glyphs, and the shell's `dk-` classes for the light/dark swap.
 */

import { Column, Container, Row } from "react-email"
import { color, font } from "../components/tokens.ts"
import { signatory } from "./signatureData.ts"
import { ContactRow, SignatureLogo, Socials, SignatureShell } from "./signatureShell.tsx"

const contact = { fontSize: 11.5, gap: 7, iconSize: 13 } as const
const cell = { verticalAlign: "middle", width: "50%" } as const

export const CompactSignature = () => (
  <SignatureShell title="Fencing Club — Compact signature">
    <Container style={{ margin: 0, maxWidth: 520, width: 520 }}>
      <Row>
        <Column style={{ paddingRight: 16, verticalAlign: "middle", width: 76 }}>
          <SignatureLogo height={93} />
        </Column>
        <Column style={{ verticalAlign: "middle", width: 1 }}>
          <div
            className="dk-hairline"
            style={{ backgroundColor: color.line, fontSize: 0, height: 87, lineHeight: 0, width: 1 }}
          />
        </Column>
        <Column style={{ paddingLeft: 16, verticalAlign: "middle" }}>
          <Row>
            <Column style={{ verticalAlign: "middle" }}>
              <div
                className="dk-text"
                style={{
                  color: color.ink,
                  fontFamily: font.display,
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: -0.3,
                  lineHeight: "20px"
                }}
              >
                {signatory.name}
              </div>
              <div
                className="dk-muted"
                style={{
                  color: color.inkSoft,
                  fontFamily: font.body,
                  fontSize: 11.5,
                  lineHeight: "16px",
                  paddingTop: 1
                }}
              >
                {signatory.title}
              </div>
            </Column>
            <Column style={{ paddingLeft: 16, textAlign: "right", verticalAlign: "middle", width: 52 }}>
              <Socials gap={10} size={15} style={{ marginLeft: "auto" }} />
            </Column>
          </Row>
          <div
            className="dk-hairline"
            style={{ backgroundColor: color.line, fontSize: 0, height: 1, lineHeight: 0, margin: "12px 0" }}
          />
          <Row>
            <Column style={{ ...cell, paddingRight: 16 }}>
              <ContactRow {...contact} href={`mailto:${signatory.email}`} icon="mail">
                {signatory.email}
              </ContactRow>
            </Column>
            <Column style={cell}>
              <ContactRow {...contact} href={signatory.phone.href} icon="phone">
                {signatory.phone.label}
              </ContactRow>
            </Column>
          </Row>
          <Row>
            <Column style={{ ...cell, paddingRight: 16, paddingTop: 8 }}>
              <ContactRow {...contact} href={signatory.website.href} icon="globe">
                {signatory.website.label}
              </ContactRow>
            </Column>
            <Column style={{ ...cell, paddingTop: 8 }}>
              <ContactRow {...contact} icon="mapPin">
                {signatory.location}
              </ContactRow>
            </Column>
          </Row>
        </Column>
      </Row>
    </Container>
  </SignatureShell>
)

export default CompactSignature
