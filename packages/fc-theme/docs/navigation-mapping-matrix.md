# Navigation Mapping Matrix

Version: 2026-07-11
Status: Implemented preview navigation reference
Source of truth: `theme/docs/seo-navigation-and-sitelinks-spec.md` section 7

This matrix documents every existing menu destination's disposition in the
implemented preview architecture.

## Disposition key

| Code | Meaning |
| --- | --- |
| **RETAINED** | Link stays in navigation with same label and URL. |
| **RELABELED** | Link stays with corrected label; URL unchanged. |
| **MOVED** | Link moved to a different parent hub; URL unchanged. |
| **PROMOTED** | Link elevated to a higher level in the hierarchy. |
| **REMOVED-NAV** | Removed from global navigation; canonical page preserved and crawlable. |
| **BLOCKED** | Not added until a dedicated, accurate destination exists. |

---

## Top-level items

| Current label | Current URL | Disposition | Proposed label | Proposed parent | Notes |
| --- | --- | --- | --- | --- | --- |
| Weapons | /collections/weapons | RETAINED | Weapons | Top-level | |
| Masks | /collections/masks | RETAINED | Masks | Top-level | |
| Clothing | /collections/clothing | RETAINED | Clothing | Top-level | |
| Shoes | /collections/shoes | RELABELED + PROMOTED | Footwear | Top-level | Was under a secondary branch; now explicitly top-level. Child Socks link added. |
| Bags | /collections/bags | RETAINED | Bags | Top-level | |
| Starter Kits | /collections/starter-kits | DEFERRED | — | — | Product line is unreleased. Preserve the collection but hide the complete branch until launch. |
| Scoring (or More) | /collections/scoring | MOVED | Scoring Equipment | Club Gear | Previously under "More"; moved to dedicated Club Gear group. |
| Tools (or More) | /collections/tools | MOVED | Repair Tools | Club Gear | Previously under "More"; moved to dedicated Club Gear group. |
| More | /collections/more | REMOVED-NAV | — | — | "More" removed as a label. Contents redistributed. /collections/more URL preserved. |

---

## Weapons submenu

| Current label | Current URL | Disposition | Proposed label | Proposed parent | Notes |
| --- | --- | --- | --- | --- | --- |
| Foils (complete) | /collections/foil-weapons | RELABELED | Foil Weapons | Complete Weapons | Disambiguated from Foil Blades. |
| Epees (complete) | /collections/epee-weapons | RELABELED | Epee Weapons | Complete Weapons | Disambiguated from Epee Blades. |
| Sabers (complete) | /collections/saber-weapons | RELABELED | Saber Weapons | Complete Weapons | Disambiguated from Saber Blades. |
| Foils (blades) | /collections/foil-blades | RELABELED | Foil Blades | Blades | Disambiguated from Foil Weapons. |
| Epees (blades) | /collections/epee-blades | RELABELED | Epee Blades | Blades | Disambiguated from Epee Blades. |
| Sabers (blades) | /collections/saber-blades | RELABELED | Saber Blades | Blades | Disambiguated from Saber Weapons. |
| Body Cords | /collections/body-cords | RETAINED | Body Cords | Weapons | |
| Parts | /collections/weapon-parts | RELABELED | Weapon Parts | Weapons | "Parts" was too generic; now has weapon context. |
| Points | /collections/points | RETAINED | Points | Weapon Parts | |
| Tip Screws | /collections/tip-screws | RETAINED | Tip Screws | Weapon Parts | |
| Grips | /collections/grips | RETAINED | Grips | Weapon Parts | |
| Guards | /collections/guards | RETAINED | Guards | Weapon Parts | |
| Pads | /collections/pads | RETAINED | Pads | Weapon Parts | |
| Pommels and Nuts | /collections/pommels-and-nuts | RELABELED | Pommels | Weapon Parts | Concise label; destination unchanged. |
| Sockets | /collections/sockets | RETAINED | Sockets | Weapon Parts | |

---

## Masks submenu

| Current label | Current URL | Disposition | Proposed label | Proposed parent | Notes |
| --- | --- | --- | --- | --- | --- |
| Complete Masks | /collections/complete-masks | REMOVED-NAV | — | — | Canonical page preserved; no longer a navigation branch. Shoppers route via weapon-specific mask links. |
| Foil Masks | /collections/foil-masks | PROMOTED | Foil Masks | Masks (direct child) | Elevated from under Complete Masks to direct Masks child. |
| Epee Masks | /collections/epee-masks | PROMOTED | Epee Masks | Masks (direct child) | Elevated from under Complete Masks to direct Masks child. |
| Saber Masks | /collections/saber-masks | PROMOTED | Saber Masks | Masks (direct child) | Elevated from under Complete Masks to direct Masks child. |
| Mask Parts | /collections/mask-parts | RETAINED | Mask Parts | Masks | |
| Mask Bibs | /collections/mask-bibs | RETAINED | Mask Bibs | Mask Parts | |
| Mask Cords | /collections/mask-cords | RETAINED | Mask Cords | Mask Parts | |

---

## Clothing submenu

| Current label | Current URL | Disposition | Proposed label | Proposed parent | Notes |
| --- | --- | --- | --- | --- | --- |
| Equipment | /collections/unisex-clothing | RELABELED + MOVED | Unisex Clothing | Clothing | Ambiguous label removed; explicit unisex subgroup restored. |
| Men's Clothing (or Jackets) | /collections/mens-clothing | RETAINED | Men's Clothing | Clothing | Hub for men's clothing preserved. |
| Jackets (men's) | /collections/mens-fencing-jackets | RELABELED | Men's Jackets | Men's Clothing | Audience context added. |
| Pants (men's) | /collections/mens-fencing-pants | RELABELED | Men's Pants | Men's Clothing | Audience context added. |
| Chest Protectors (men's) | /collections/mens-chest-protectors | RELABELED | Men's Chest Protectors | Men's Clothing | Audience context added. |
| Men's Lames | /collections/mens-lames | RETAINED | Men's Lames | Men's Clothing | |
| Women's Clothing | /collections/womens-clothing | RETAINED | Women's Clothing | Clothing | Hub for women's clothing preserved. |
| Jackets (women's) | /collections/womens-fencing-jackets | RELABELED | Women's Jackets | Women's Clothing | Audience context added. |
| Pants (women's) | /collections/womens-fencing-pants | RELABELED | Women's Pants | Women's Clothing | Audience context added. |
| Chest Protectors (women's) | /collections/womens-chest-protectors | RELABELED | Women's Chest Protectors | Women's Clothing | Audience context added. |
| Women's Lames | /collections/womens-lames | RETAINED | Women's Lames | Women's Clothing | |
| Underarm Protectors | /collections/fencing-underarm-protectors | RETAINED | Underarm Protectors | Clothing | |
| Gloves | /collections/gloves | RETAINED | Gloves | Clothing | |

---

## Footwear submenu

| Current label | Current URL | Disposition | Proposed label | Proposed parent | Notes |
| --- | --- | --- | --- | --- | --- |
| (new parent) | /collections/footwear | ADDED | Footwear | Top-level | Automated Shoes OR Socks product-type union. |
| Shoes | /collections/shoes | RETAINED | Shoes | Footwear | Child destination retained. |
| Socks | /collections/socks | RETAINED | Socks | Footwear | |

---

## Bags

| Current label | Current URL | Disposition | Proposed label | Proposed parent | Notes |
| --- | --- | --- | --- | --- | --- |
| Bags | /collections/bags | RETAINED | Bags | Top-level | Automated Wheel Bags and Carry Bags children added. |
| (new) | /collections/wheel-bags | ADDED | Wheel Bags | Bags | Automated Bag style = Wheel. |
| (new) | /collections/carry-bags | ADDED | Carry Bags | Bags | Automated Bag style = Carry. |

---

## Starter Kits submenu (deferred)

| Current label | Current URL | Disposition | Proposed label | Proposed parent | Notes |
| --- | --- | --- | --- | --- | --- |
| Starter Kits | /collections/starter-kits | DEFERRED | Starter Kits | Future top-level | Re-add only when the product line launches. |
| Foil Kits | /collections/foil-kits | DEFERRED | Foil Kits | Future Starter Kits | Empty until released products receive verified metafields. |
| Epee Kits | /collections/epee-kits | DEFERRED | Epee Kits | Future Starter Kits | Empty until released products receive verified metafields. |
| Saber Kits | /collections/saber-kits | DEFERRED | Saber Kits | Future Starter Kits | Empty until released products receive verified metafields. |
| Kids' Equipment | /collections/kids | DEFERRED FROM GLOBAL NAV | Kids' Equipment | Future Starter Kits | Collection remains available; no standalone global link is introduced. |

---

## Club Gear submenu (new hub)

| Current label | Current URL | Disposition | Proposed label | Proposed parent | Notes |
| --- | --- | --- | --- | --- | --- |
| (new parent) | /collections/club-gear | ADDED | Club Gear | Top-level | Automated Scoring OR Tools-category union. |
| Scoring (under More) | /collections/scoring | MOVED | Scoring Equipment | Club Gear | Descriptive label added. |
| Tools (under More) | /collections/tools | MOVED | Repair Tools | Club Gear | Descriptive label added. |
| (not present) | /collections/more | REMOVED-NAV | — | — | /collections/more URL not used as Reels & Floor Cables destination in current state. |
| Scoring products | /collections/scoring-systems | ADDED | Scoring Systems | Club Gear | New manual collection with seven apparatus/control products. |
| Reels & Floor Cables | /collections/reels-floor-cables | ADDED | Reels and Floor Cables | Club Gear | New manual collection with eight reel/cable products. |

---

## Canonical pages removed from navigation

These pages remain canonical, crawlable, and in the sitemap. They are simply not
linked from global navigation.

| Handle | URL | Reason removed from navigation |
| --- | --- | --- |
| complete-masks | /collections/complete-masks | Overlaps Foil, Epee, and Saber Masks. Customers navigate via weapon-specific mask links. |
| unisex-clothing | /collections/unisex-clothing | Never label "Equipment". Products must surface through audience-specific or garment-specific categories. |
| more | /collections/more | Ambiguous scope. Not a customer intent category. URL preserved; not reused for Reels. |

---

## Known blockers

| Item | Status | Blocker |
| --- | --- | --- |
| Reels and Floor Cables | RESOLVED | Dedicated `/collections/reels-floor-cables` exists. Never substitute `/collections/more`. |
| Unisex Clothing product re-assignment | Deferred | Requires explicit product-by-product review before catalog changes. No automatic reassignment. |
| Starter Kits branch | RESOLVED BY DEFERRAL | Products are intentionally unreleased. The branch is absent from all three 49-item additive menus. Collections and rollback evidence are preserved for launch. |
