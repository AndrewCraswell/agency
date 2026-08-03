import { If, isPresent, type OrderAddress, type PathRef, Var } from "@repo/shopify-emails"
import type { ReactNode } from "react"
import { Section } from "react-email"
import { color, font, gutter, sectionGap } from "./tokens.ts"

export type AddressDetailProps = {
  /** The small caps line above the name, such as SHIP TO. */
  readonly kicker: string
  readonly headline: ReactNode
  readonly children?: ReactNode
}

/*
 * A place, written the way a place is written: a name, then the lines under it. Unboxed, because
 * it sits inside the message rather than beside it, and a card would read as a second subject.
 */
export const AddressDetail = ({ children, headline, kicker }: AddressDetailProps) => (
  <>
    <div
      className="dk-muted"
      style={{
        color: color.inkSoft,
        fontFamily: font.body,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "1.8px",
        lineHeight: "14px",
        paddingBottom: 6
      }}
    >
      {kicker}
    </div>
    <div
      className="dk-text"
      style={{ color: color.ink, fontFamily: font.body, fontSize: 12.5, fontWeight: 700, lineHeight: "17px" }}
    >
      {headline}
    </div>
    {children === undefined ? null : (
      <div
        className="dk-muted"
        style={{
          color: color.inkSoft,
          fontFamily: font.body,
          fontSize: 11.5,
          fontWeight: 400,
          lineHeight: "17px",
          paddingTop: 2
        }}
      >
        {children}
      </div>
    )}
  </>
)

export type AddressBlockProps = AddressDetailProps

export const AddressBlock = (props: AddressBlockProps) => (
  <Section className="px" style={{ padding: `${sectionGap}px ${gutter}px 0` }}>
    <AddressDetail {...props} />
  </Section>
)

export type AddressPartyProps = {
  readonly address: PathRef<OrderAddress>
  readonly kicker: string
}

/* A second address line is the exception, so it joins the first rather than claiming a line. */
export const AddressParty = ({ address, kicker }: AddressPartyProps) => (
  <AddressDetail
    headline={
      <>
        <Var path={address.first_name} /> <Var path={address.last_name} />
      </>
    }
    kicker={kicker}
  >
    <div>
      <Var path={address.address1} />
      <If test={isPresent(address.address2)}>
        , <Var path={address.address2} />
      </If>
    </div>
    <div>
      <Var path={address.city} />, <Var path={address.province_code} /> <Var path={address.zip} />
    </div>
    <div>
      <Var path={address.country} />
    </div>
  </AddressDetail>
)
