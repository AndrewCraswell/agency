import type { ReactNode } from "react"
import { Column, Row, Section } from "react-email"
import { color, font, radius } from "./tokens.ts"

export type TestimonialItem = {
  readonly quote: ReactNode
  readonly name: string
  /** What the reviewer fences, which is what makes the quote worth reading. */
  readonly role: string
  readonly initials: string
  readonly rating?: number
}

export type TestimonialsProps = {
  readonly items: readonly TestimonialItem[]
  readonly spacing?: number
}

/* Text stars rather than an image: they survive a blocked-image client, which is where a review has
 * to work hardest. */
const stars = (rating: number) => "★".repeat(rating)

export const Testimonials = ({ items, spacing = 20 }: TestimonialsProps) => (
  <>
    {items.map((item, index) => (
      <Section key={item.name} style={{ paddingTop: index === 0 ? spacing : 12 }}>
        <Section className="dk-card" style={{ backgroundColor: color.bg, borderRadius: radius, padding: "18px 20px" }}>
          <div
            className="dk-text"
            style={{ color: color.ink, fontFamily: font.body, fontSize: 13, letterSpacing: 2, lineHeight: "18px" }}
          >
            {stars(item.rating ?? 5)}
          </div>
          <div
            className="dk-text"
            style={{
              color: color.ink,
              fontFamily: font.body,
              fontSize: 14,
              fontWeight: 400,
              lineHeight: "22px",
              paddingTop: 10
            }}
          >
            {item.quote}
          </div>
          <Row style={{ borderCollapse: "separate" }}>
            <Column style={{ paddingRight: 10, paddingTop: 14, verticalAlign: "middle", width: 34 }}>
              <Row style={{ borderCollapse: "separate", width: 34 }}>
                <Column
                  align="center"
                  style={{
                    backgroundColor: color.surfaceDark,
                    borderRadius: 999,
                    color: color.onDark,
                    fontFamily: font.body,
                    fontSize: 12,
                    fontWeight: 700,
                    height: 34,
                    textAlign: "center",
                    verticalAlign: "middle",
                    width: 34
                  }}
                >
                  {item.initials}
                </Column>
              </Row>
            </Column>
            <Column style={{ paddingTop: 14, verticalAlign: "middle" }}>
              <div
                className="dk-text"
                style={{ color: color.ink, fontFamily: font.body, fontSize: 13, fontWeight: 700, lineHeight: "18px" }}
              >
                {item.name}
              </div>
              <div
                className="dk-muted"
                style={{
                  color: color.inkSoft,
                  fontFamily: font.body,
                  fontSize: 12,
                  fontWeight: 400,
                  lineHeight: "17px",
                  paddingTop: 1
                }}
              >
                {item.role}
              </div>
            </Column>
          </Row>
        </Section>
      </Section>
    ))}
  </>
)
