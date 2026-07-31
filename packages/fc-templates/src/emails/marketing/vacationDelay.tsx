import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Column, Row, Section } from "react-email"
import { Band } from "../components/Band.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { NoticeBox, StatusStrip, Timeline } from "../components/Status.tsx"
import { SpecStrip } from "../components/Strips.tsx"
import { SupportBand } from "../components/SupportBand.tsx"
import { color, font, gutter, radius, shopLinks } from "../components/tokens.ts"

export const vacationDelay = defineTemplate({
  id: "marketing_vacation_delay",
  subject: () => "Thanks for your order — we’re on the road",
  render: (vars) => (
    <EmailDocument preview="Your order is confirmed and reserved. Shipping resumes March 4." title="We’re on the road">
      <EmailHeader eyebrow="STORE UPDATE" />
      <StatusStrip>VACATION MODE / SHIPPING PAUSED</StatusStrip>
      <MarketingHero
        headline="Thanks for your order! We’re on the road."
        icon="plane"
        lead="Your order is confirmed and your items are reserved. Our small team is away right now, so anything placed during this window ships as soon as we’re back at the workshop."
      />
      <SpecStrip
        items={[
          { label: "WE’RE AWAY", value: "Feb 24 to Mar 3" },
          { label: "SHIPPING RESUMES", value: "March 4" }
        ]}
        tone="dark"
      />
      <Band heading="Here’s the plan" headingSize={24} kicker="WHAT HAPPENS NEXT" padding={36}>
        <Timeline
          items={[
            { note: "We’ve got your order and your items are set aside.", stage: "done", title: "Order received" },
            {
              note: "Traveling to a competition and away from the workbench.",
              stage: "active",
              title: "We’re away, Feb 24 to Mar 3"
            },
            {
              note: "We pack and ship the day we’re back, then email your tracking.",
              stage: "pending",
              title: "Ships March 4"
            }
          ]}
        />
      </Band>
      <Section className="px" style={{ padding: `0 ${gutter}px` }}>
        <Section
          className="dk-surface"
          style={{ backgroundColor: color.surface, borderRadius: radius, padding: "18px 20px" }}
        >
          <Row>
            <Column className="stack" style={{ verticalAlign: "middle" }}>
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
            <Column className="stack" style={{ textAlign: "right", verticalAlign: "middle", width: 130 }}>
              <a
                className="dk-btn"
                href={shopLinks.trackOrder}
                style={{
                  backgroundColor: color.accent,
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
      </Section>
      <NoticeBox kicker="NEED IT SOONER?">
        If this timing doesn’t work for you, just reply to this email or contact us. We’ll cancel and refund your order
        right away, no trouble at all.
      </NoticeBox>
      <SupportBand heading="We still read every email">
        Even while we’re away we check in daily. Reply anytime and we’ll get back to you as soon as we can.
      </SupportBand>
      <MarketingFooter shop={vars.shop} unsubscribeUrl={liquidValue(vars.unsubscribe_url)} />
    </EmailDocument>
  )
})

export default definePreview(vacationDelay)
