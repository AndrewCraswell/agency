import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { CtaBand } from "../components/CtaBand.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { FeatureList } from "../components/FeatureList.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { Testimonials } from "../components/Testimonials.tsx"
import { shopLinks } from "../components/tokens.ts"

const heroImage = {
  alt: "Fencers lined up along a club piste",
  src: "https://images.unsplash.com/photo-1631529819887-5b4340090570?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

export const community = defineTemplate({
  id: "marketing_community",
  subject: () => "Rated 4.9 by 2,400+ fencers",
  render: (vars) => (
    <EmailDocument
      preview="What fencers say about us, and how clubs and groups order together."
      title="You’re part of something"
    >
      <EmailHeader eyebrow="COMMUNITY / SOCIAL PROOF" />
      <MarketingHero
        chip="JOIN THE COMMUNITY"
        headline="You’re part of something."
        image={heroImage}
        lead="From first-time fencers to national medalists, thousands trust Fencing Club for their gear. Here’s what they say, plus how clubs and groups fence with us."
      >
        <EmailButton href={shopLinks.reviews} spacing={14}>
          Read the reviews
        </EmailButton>
      </MarketingHero>
      <Band heading="Rated 4.9 by 2,400+ fencers" headingSize={24} kicker="WHAT FENCERS SAY" tone="surface">
        <Testimonials
          items={[
            {
              initials: "MR",
              name: "Maya R.",
              quote:
                "“My foil arrived wired, tested and strip-ready, plugged in on club night and it just worked. This is my shop now.”",
              role: "Foilist / 2 years"
            },
            {
              initials: "DK",
              name: "Daniel K.",
              quote:
                "“Ordered a full épée setup as a total beginner. The starter kit took the guesswork out of it completely.”",
              role: "New fencer"
            },
            {
              initials: "EV",
              name: "Coach Elena V.",
              quote:
                "“Fast shipping, genuine gear, and an armory team that actually answers technical questions. Rare.”",
              role: "Club coach"
            }
          ]}
        />
      </Band>
      <Band heading="Fencing together? We’ve got you." headingSize={24} kicker="FOR CLUBS AND GROUPS">
        <FeatureList
          items={[
            {
              body: "Set up a club account for shared ordering, roster sizing help and a dedicated point of contact.",
              icon: "users",
              title: "Club and team accounts"
            },
            {
              body: "Kitting out a squad? Group pricing kicks in on bulk uniform and weapon orders.",
              icon: "percent",
              title: "Group and bulk discounts"
            },
            {
              body: "Special terms for coaches, schools and after-school programs, just reach out to set it up.",
              icon: "graduationCap",
              title: "Coach and school programs"
            }
          ]}
        />
      </Band>
      <CtaBand
        chip="YOUR OFFER IS STILL ACTIVE"
        code={{ note: "10% off / valid 14 days", value: "WELCOME10" }}
        headline="Ready for your first bout?"
        href={shopLinks.shop}
        label="Complete your first order"
        support="Take 10% off your first order and join the fencers above on the strip. Your welcome code is ready to go."
      />
      <MarketingFooter
        fine="You’re receiving this because you subscribed to Fencing Club. See you on the strip."
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(community)
