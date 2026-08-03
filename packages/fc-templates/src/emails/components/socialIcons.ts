/*
 * The two social glyphs, hosted on the shop's own CDN rather than inlined.
 *
 * Gmail serves every image through its proxy and drops a `data:` source on the way, so a base64
 * icon rendered nowhere that matters. `pnpm cli upload` puts a new one up; the source PNGs are in
 * `src/images/`.
 *
 * Both carry a little colour noise. It was meant to stop a dark-mode reader inverting them and it
 * does not — Gmail inverts both — but it does make them invert alike, which is what the pair needs.
 */

export const instagramIcon =
  "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/social-instagram_e79c7145-3bb5-4743-9be9-8ba3b5d39a49.png?v=1785757941"

export const facebookIcon =
  "https://cdn.shopify.com/s/files/1/0848/2527/6713/files/social-facebook_363eeee5-2b59-47ef-aee1-0394d1059699.png?v=1785757864"
