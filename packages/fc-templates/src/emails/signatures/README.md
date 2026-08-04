# Email signatures

Two Fencing Club email signatures, authored with React Email so they compile to email-safe HTML, and built to hold up in
both a light and a dark client. They are transparent — no card, no border — so they sit on whatever background the
client gives them.

| File                   | What it is                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ClassicSignature.tsx` | Full-height shield, a hairline, then the name with the socials up top and the four contact lines stacked. The conventional one. |
| `CompactSignature.tsx` | The same shield, but a denser block — name and socials over a hairline, then the four facts in two columns.                     |
| `signatureShell.tsx`   | The shared `<Html>` shell, the dark-mode `<style>`, and the logo/contact/social pieces.                                         |
| `signatureData.ts`     | The one person the signatures name, and the two logo URLs.                                                                      |
| `signatureIcons.ts`    | The contact and social glyphs, inline base64 PNGs (see below).                                                                  |
| `assets/`              | The source shield PNGs, kept beside the code.                                                                                   |

## Preview

Same dev server as the emails — every `.tsx` here default-exports a component the server renders:

```
cd packages/fc-templates
pnpm dev
```

## Render to HTML

```ts
import { render } from "@react-email/render"
import ClassicSignature from "./ClassicSignature.tsx"

const html = await render(<ClassicSignature />)
```

Paste the result into the signature box of a mail client, or serve it — it is self-contained HTML.

## Light and dark

The markup carries `dk-` classes and the shell's `<style>` recolours them under `@media (prefers-color-scheme: dark)`,
with `[data-ogsc]`/`[data-ogsb]` repeats for Outlook.com — the same contract the notification emails use. Because a PNG
cannot be recoloured, the three images that are strokes rather than colour — the shield, the contact glyphs, the social
glyphs — are each carried twice and the dark rule swaps one cut for the other.

The signature sets no background of its own, so in a light client it reads as black on white and in a dark one as white
on the client's own dark. Clients that report no scheme (Gmail among them) keep the light cut, which is the safe
default.

## Images

Two kinds, both chosen so nothing new has to be hosted:

- **The shield** is a hosted image, and both cuts already live on the shop's CDN: the black shield is the one the
  printout mastheads print, the white the email header shows. The source PNGs sit in `assets/` for reference;
  `pnpm cli upload` re-hosts one if a crisper export is ever wanted, after which its URL in `signatureData.ts` takes the
  new `?v=` hash.
- **The contact and social glyphs** are inline base64 PNGs in `signatureIcons.ts`, the same way `lineIcons.ts` carries
  its glyphs — Gmail drops SVG and blocks remote images, so an inline raster is the cut that renders everywhere. They
  are rendered from the design's lucide glyphs, each in its light cut (the muted greys for contacts, the ink for
  socials) and the white cut the dark rule swaps in. Regenerate them with `sharp` from the lucide paths if the set ever
  changes.

## Another person

Copy `signatory` in `signatureData.ts` into a second object and pass it in — everything else is layout and moves with
it.
