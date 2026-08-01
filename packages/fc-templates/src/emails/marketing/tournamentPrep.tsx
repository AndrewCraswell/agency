import { definePreview, defineTemplate, liquidValue } from "@repo/shopify-emails"
import { Band } from "../components/Band.tsx"
import { EmailButton } from "../components/EmailButton.tsx"
import { EmailDocument } from "../components/EmailDocument.tsx"
import { MarketingFooter } from "../components/EmailFooter.tsx"
import { EmailHeader } from "../components/EmailHeader.tsx"
import { MarketingHero } from "../components/MarketingHero.tsx"
import { ProductCards } from "../components/ProductCards.tsx"
import { Checklist, NoticeBox } from "../components/Status.tsx"
import { SupportBand } from "../components/SupportBand.tsx"

const prepUrl = "https://fencing.club/collections/tournament-prep"

const heroImage = {
  alt: "A fencer checking a weapon before a bout",
  src: "https://images.unsplash.com/photo-1779831910458-f0419b4cba3c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
}

const shot = (photo: string) =>
  `https://images.unsplash.com/${photo}?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&h=460&q=80&w=530`

export const tournamentPrep = defineTemplate({
  id: "marketing_tournament_prep",
  subject: () => "Is your bag tournament-ready?",
  render: (vars) => (
    <EmailDocument
      preview="Restock the essentials before you travel to Charlotte for the January NAC."
      title="Is your bag tournament-ready?"
    >
      <EmailHeader eyebrow="TOURNAMENT PREP" />
      <MarketingHero
        chip="NORTH AMERICAN CUP / NAC B"
        chipTone="translucent"
        headline="Is your bag tournament-ready?"
        image={heroImage}
        lead="January 17 to 20 in Charlotte, NC. Don’t let a snapped blade or dead cord end your day. Restock the essentials before you travel."
        tone="dark"
      >
        <EmailButton href={prepUrl} spacing={14} variant="inverse">
          Shop tournament prep
        </EmailButton>
      </MarketingHero>
      <NoticeBox kicker="ORDER BY JAN 10">
        Order by January 10 for guaranteed delivery before you leave for Charlotte.
      </NoticeBox>
      <Band heading="The pre-tournament checklist" headingSize={24} kicker="BEFORE YOU PACK" padding={36}>
        <Checklist
          items={[
            {
              note: "The number one cause of a carded touch. Bring backups for foil and épée.",
              title: "Two spare body cords"
            },
            { note: "Don’t repair mid-bout, just swap and keep fencing.", title: "A spare weapon, fully assembled" },
            { note: "The small parts that fail at the worst time.", title: "Extra tips, springs and pointe wires" },
            { note: "Cheap insurance for an electric mask.", title: "Mask cord and clip" },
            { note: "Allen keys, screwdriver and shims to pass weapon check.", title: "An armorer’s tool kit" },
            { note: "Show up clean, pass inspection, look sharp.", title: "Fresh lamé and spare glove" }
          ]}
        />
      </Band>
      <Band
        heading="Competition essentials"
        headingSize={24}
        kicker="RESTOCK BEFORE YOU TRAVEL"
        padding={36}
        tone="surface"
      >
        <ProductCards
          items={[
            {
              href: "https://fencing.club/products/foil-body-cord-2-pack",
              image: shot("photo-1631529335371-c7eb1bc35b51"),
              price: "$38",
              tag: "BODY CORDS",
              title: "Foil Body Cord / 2 Pack"
            },
            {
              href: "https://fencing.club/products/fie-maraging-blade",
              image: shot("photo-1653638601173-63729980bfba"),
              price: "$72",
              tag: "BLADES",
              title: "FIE Maraging Blade"
            }
          ]}
        />
        <ProductCards
          items={[
            {
              href: "https://fencing.club/products/competition-foil",
              image: shot("photo-1779831910265-589c9bcea696"),
              price: "$189",
              tag: "WEAPONS",
              title: "Competition Foil / Assembled"
            },
            {
              href: "https://fencing.club/products/tip-wire-repair-set",
              image: shot("photo-1648484859987-0da8b9d58a80"),
              price: "$24",
              tag: "SPARE PARTS",
              title: "Tip and Wire Repair Set"
            }
          ]}
          spacing={22}
        />
        <ProductCards
          items={[
            {
              href: "https://fencing.club/products/armorers-tool-kit",
              image: shot("photo-1648484860115-906abc06a59a"),
              price: "$45",
              tag: "TOOLS",
              title: "Armorer’s Tool Kit"
            },
            {
              href: "https://fencing.club/products/foil-lame-800n",
              image: shot("photo-1648500128065-2f67c752ed36"),
              price: "$139",
              tag: "LAMÉ",
              title: "Foil Lamé / 800N"
            }
          ]}
          spacing={22}
        />
      </Band>
      <SupportBand heading="Weapon check questions?">
        Not sure your setup will pass inspection? Reply to this email and our armorers will help you get
        tournament-legal.
      </SupportBand>
      <MarketingFooter
        fine="You’re receiving this because you asked for competition reminders from Fencing Club."
        flush
        shop={vars.shop}
        unsubscribeUrl={liquidValue(vars.unsubscribe_url)}
      />
    </EmailDocument>
  )
})

export default definePreview(tournamentPrep)
