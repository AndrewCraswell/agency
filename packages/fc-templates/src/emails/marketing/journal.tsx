import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { ArticleCards, FeaturedArticle } from "../components/ArticleCards.tsx"
import { Band } from "../components/Band.tsx"
import { CtaBand } from "../components/CtaBand.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"

const journalUrl = "https://fencing.club/blogs/journal"

const shot = (photo: string, width: number, height: number) =>
  `https://images.unsplash.com/${photo}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=${height}&q=80&w=${width}`

export const journal = defineTemplate({
  id: "marketing_journal",
  subject: () => "This month on the strip",
  render: (vars) => (
    <EmailDocument
      preview="Technique breakdowns, gear guides and athlete stories from the Fencing Club community."
      title="This month on the strip"
    >
      <EmailHeader eyebrow="THE JOURNAL" />
      <MarketingHero
        chip="THE JOURNAL / ISSUE 14"
        chipTone="quiet"
        headline="This month on the strip"
        lead="Fresh technique breakdowns, gear guides, and athlete stories from the Fencing Club community."
      >
        <FeaturedArticle
          badge="FEATURED"
          excerpt="Three coaches break down the advance-lunge patterns and blade preparation that separate a clean touch from a scramble. Drills you can take straight to practice tonight."
          href={`${journalUrl}/distance-and-timing`}
          image={shot("photo-1648500127279-69a6cccdb84f", 1024, 540)}
          label="Read the story"
          meta="Technique / 6 min read"
          title="Distance and timing: the footwork drills that win bouts"
        />
      </MarketingHero>
      <Band heading="Worth a read" headingSize={24} kicker="MORE FROM THE JOURNAL" padding={36} tone="surface">
        <ArticleCards
          items={[
            {
              excerpt: "A plain-English guide to scoring boxes, body cords and reels.",
              href: `${journalUrl}/steam-vs-electric`,
              image: shot("photo-1631529335371-c7eb1bc35b51", 520, 280),
              meta: "Gear / 5 min",
              title: "Steam vs. electric: which setup is right for you?"
            },
            {
              excerpt: "What she packs for a two-day tournament, down to the spare tips.",
              href: `${journalUrl}/inside-a-competition-bag`,
              image: shot("photo-1648500128065-2f67c752ed36", 520, 280),
              meta: "Athlete / 4 min",
              title: "Inside a national medalist’s competition bag"
            }
          ]}
        />
        <ArticleCards
          items={[
            {
              excerpt: "Simple habits that stop rust, keep tips working and prevent breaks.",
              href: `${journalUrl}/make-your-blade-last`,
              image: shot("photo-1653638601173-63729980bfba", 520, 280),
              meta: "Care / 3 min",
              title: "Make your blade last: maintenance in 10 minutes"
            },
            {
              excerpt: "Notes from coaches on welcoming first-timers to the strip.",
              href: `${journalUrl}/beginner-open-night`,
              image: shot("photo-1648500128137-5d4210c9fe34", 520, 280),
              meta: "Community / 4 min",
              title: "How our club runs a beginner-friendly open night"
            }
          ]}
          spacing={16}
        />
      </Band>
      <CtaBand
        headline="Read the full Journal"
        href={journalUrl}
        kicker="NEVER MISS AN ISSUE"
        label="Visit the Journal"
        support="Every article, guide and athlete story in one place, updated all season long."
      />
      <MarketingFooter
        fine="You’re receiving this because you subscribed to the Fencing Club Journal."
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(journal)
