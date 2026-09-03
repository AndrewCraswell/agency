import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Column, Row, Section } from "react-email"
import { Band, BandCopy } from "../components/Band.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { StatusStrip } from "../components/Status.tsx"
import { accentFill, color, font, gutter, radius, shopLinks } from "../components/tokens.ts"

export const vacationDelay = defineTemplate({
  id: "marketing_vacation_delay",
  subject: () => "Thanks for your order — shipping resumes September 15",
  render: (vars) => (
    <EmailDocument preview="Your order is confirmed. Our team is out of town." title="Your order is confirmed">
      <EmailHeader eyebrow="SHIPPING UPDATE" />
      <StatusStrip>SHIPPING ON HOLD</StatusStrip>
      <MarketingHero
        headline="Your order is confirmed. Our team is out of town."
        icon="plane"
        lead="Our team is traveling for fencing events, and shipping is on hold while we’re away. As a reminder, all orders placed during this time will ship after we return to the office."
      />
      <Section className="px" style={{ padding: `0 ${gutter}px` }}>
        <Section className="dk-surface" style={{ backgroundColor: color.surface, borderRadius: radius }}>
          <Section style={{ padding: "18px 20px" }}>
            <Row>
              <Column className="pair" style={{ verticalAlign: "middle" }}>
                <div
                  className="dk-text"
                  style={{
                    color: color.ink,
                    fontFamily: font.body,
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: "20px"
                  }}
                >
                  Order #FC-1042
                </div>
                <div
                  className="dk-muted"
                  style={{
                    color: color.inkSoft,
                    fontFamily: font.body,
                    fontSize: 13,
                    fontWeight: 400,
                    lineHeight: "19px",
                    paddingTop: 2
                  }}
                >
                  3 items / $214.00
                </div>
              </Column>
              <Column className="pair pair-left" style={{ textAlign: "right", verticalAlign: "middle", width: 130 }}>
                <a
                  className="dk-btn"
                  href={shopLinks.trackOrder}
                  style={{
                    backgroundColor: accentFill(),
                    borderRadius: 10,
                    color: color.accentInk,
                    display: "inline-block",
                    fontFamily: font.body,
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: "17px",
                    padding: "11px 18px",
                    textDecoration: "none"
                  }}
                >
                  View order
                </a>
              </Column>
            </Row>
          </Section>
          <Section className="dk-border" style={{ borderTop: `1px solid ${color.line}`, padding: "18px 20px 20px" }}>
            <Row>
              <Column style={{ paddingRight: 16, verticalAlign: "top", width: "50%" }}>
                <div
                  className="dk-muted"
                  style={{
                    color: color.inkSoft,
                    fontFamily: font.body,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.4,
                    lineHeight: "15px"
                  }}
                >
                  SHIPPING PAUSED
                </div>
                <div
                  className="dk-text"
                  style={{
                    color: color.ink,
                    fontFamily: font.display,
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: "24px",
                    paddingTop: 5
                  }}
                >
                  Sep 4 to Sep 14
                </div>
              </Column>
              <Column
                className="dk-border"
                style={{ borderLeft: `1px solid ${color.line}`, paddingLeft: 20, verticalAlign: "top", width: "50%" }}
              >
                <div
                  className="dk-muted"
                  style={{
                    color: color.inkSoft,
                    fontFamily: font.body,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.4,
                    lineHeight: "15px"
                  }}
                >
                  SHIPPING RESUMES
                </div>
                <div
                  className="dk-text"
                  style={{
                    color: color.ink,
                    fontFamily: font.display,
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: "24px",
                    paddingTop: 5
                  }}
                >
                  September 15
                </div>
              </Column>
            </Row>
          </Section>
        </Section>
      </Section>
      <Band align="center" heading="Need it sooner?" headingSize={24} padding={36}>
        <BandCopy>
          If you need your order before then, reply to this email or contact us. We can cancel it and issue a full
          refund.
        </BandCopy>
        <BandCopy>
          We’ll check email while we’re traveling. Reply anytime, and we’ll get back to you as soon as we can.
        </BandCopy>
        <EmailButton href={shopLinks.contact} spacing={20}>
          Contact us
        </EmailButton>
      </Band>
      <MarketingFooter flush shop={vars.shop} unsubscribeUrl={liquidValue(vars.unsubscribe_url)} />
    </EmailDocument>
  )
})

export default definePreview(vacationDelay)
