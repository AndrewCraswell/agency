# Size Chart Comparison and Return Analysis

Report date: July 12, 2026.

## Scope and Sources

This report compares the following apparel size charts:

1. Fencing Club's live chart: https://fencing.club/pages/size-charts
2. The Novus supplier chart supplied as an image on July 12, 2026
3. Allstar's official fencing-suit chart: https://allstar.de/media/2a/bf/a2/1693907811/allstar_suits_en-fr-de.pdf

Return evidence covers January 12, 2026 through July 12, 2026. Sales use current line-item quantity and exclude cancelled orders. Amazon return counts use the CSV `quantity` field and were matched by exact SKU.

The detailed 100-variation sales and return matrix is maintained in [jacket-pants-variation-sales-2026-01-12-to-2026-07-12.md](jacket-pants-variation-sales-2026-01-12-to-2026-07-12.md).

An additional Amazon returns export covering December 3, 2025 through February 2, 2026 was reconciled against all 100 jacket and pants SKUs. It contained no matching apparel returns. The first jacket sale occurred on February 3, 2026, after that export ended.

## Executive Conclusion

The return evidence confirms a material undersizing problem rather than an isolated transcription issue:

- 37 of 166 units were returned, an overall return rate of **22.3%**.
- 27 of 37 returns, or **73.0%**, were coded `APPAREL_TOO_SMALL`.
- Women's pants had a **75.0%** return rate; every return was too small.
- Women's jackets had a **45.5%** return rate; four of five returns were too small.
- Kids' jackets had a **30.6%** return rate; nine of eleven returns were too small.
- Men's charts align closely with Allstar, but men's products still have documented fit inconsistency in both directions.

The chart comparison identifies four actionable causes:

1. Fencing Club transcribed the supplier's women's height bands incorrectly for sizes 40 and 46.
2. The supplier's women's waist ranges place customers approximately one numbered size smaller than Allstar.
3. The supplier's size-38 women's waist range is internally overlapping and likely erroneous.
4. The live guidance encourages a close or smaller fit and the jacket chart omits waist and hip, which can push customers toward undersizing.

## Assessment and Remediation Priorities

### Overall Assessment

The evidence does not support treating this as only a wording problem or only two incorrect height cells. Three issues are occurring at the same time:

1. **Chart defects:** the live women's size-40 and size-46 height values do not match the supplier chart, and the supplier's women's size-38 waist range is internally inconsistent.
2. **Selection and listing ambiguity:** customers are encouraged to choose a close or smaller fit, jackets omit waist and hip, and marketplace variation names can make European garment sizes look like U.S. waist measurements.
3. **Possible product or labeling inconsistency:** several customers report that measured garments did not fit the chart, including a size-58 men's jacket reportedly smaller than an existing size 54.

Correcting the page is necessary, but it is not sufficient. The physical Novus garments must be measured and checked against their labels before the supplier chart can be treated as authoritative.

### Interpretation of the Return Rates

The combined operational return ratio is **22.3%**, with jackets at **25.6%** and pants at **18.4%**. This is commercially significant even before considering return freight, handling, marketplace fees, damaged packaging, and lost inventory availability.

The strongest finding is the direction of the returns:

- 27 of 37 returns, or **73.0%**, use the Amazon reason code `APPAREL_TOO_SMALL`.
- One additional return coded `DEFECTIVE` includes a "Too small" customer comment, raising the observed undersizing signal to at least 28 of 37 returns, or **75.7%**.
- Women's products account for only 15 sales, so their 45.5% and 75.0% rates are statistically unstable. However, seven of eight women's returns were too small, which is directionally consistent with the women's chart discrepancies.
- Kids' jackets provide the strongest higher-volume signal: 11 returns from 36 sales, with nine coded too small across sizes 146 through 170.
- Men's returns occur in both directions. That mixed pattern is less consistent with one simple chart offset and more consistent with ambiguous size selection, measuring differences, manufacturing tolerance, or mislabeled units.

The percentages should be described as **operational return ratios**, not final conventional return rates, until the sales denominator is confirmed. The sales export uses each order line's current quantity. If that quantity was reduced when units were returned, the 166-unit denominator is net rather than gross shipped units. The direction and reason mix remain valid, but the headline percentage could change when calculated from gross shipped units.

### Issues to Watch

#### European Sizes Presented as U.S. Measurements

Amazon pants titles include wording such as `US, Waist, 48, Regular`. A customer can reasonably interpret that as a 48-inch waist, although Novus size 48 corresponds to an approximately 80-84 cm or 31-33 inch body waist. One return comment explicitly states that the customer did not understand the European sizes.

Adult numeric sizes should always be labeled `EU`, and customer-facing options should include the corresponding body measurement. For example:

> EU 48 - body waist 80-84 cm / 31-33 in

#### Advice That Encourages Undersizing

The live jacket guidance offers a "close, athletic cut," and the pants guidance says customers may choose the smaller size for a snug fit. That advice conflicts with the return evidence and with the mobility and layering required for fencing apparel.

#### Incomplete Jacket Measurements

The live jacket table shows chest and height but omits waist and hip. A customer can therefore choose a jacket from chest alone even when waist or hip requires a larger size. This is especially risky for the women's cut, where the supplier and Allstar waist mappings differ materially.

#### Small Samples and Misleading Percentages

Several 50% and 100% variation rates are based on only one or two sales. They should trigger inspection, not automatic conclusions. Priority should be based on a combination of return rate, return count, customer comments, and chart discrepancies.

#### Physical Product and Label Consistency

Customer comments identify possible garment-level problems:

- A men's size-58 jacket was reportedly smaller than an existing size 54.
- Men's size-54 pants could not be closed despite the customer ordering above the stated waist and hip measurement.
- A kids' size-146 jacket was too small despite the chart indicating room in both chest and height.
- A women's size-50 jacket was too small in torso and chest after the customer measured and selected the closest size.

These reports require physical inspection of retained inventory and should not be dismissed as customer measurement error.

### Prioritized Remediation

#### Immediate: Customer-Facing Corrections

1. Correct women's size-40 height to 164-170 cm in both jacket and pants tables.
2. Correct women's size-46 height to 170-176 cm in both tables if the Novus supplier chart remains the source of truth.
3. Remove all recommendations to choose a smaller, snug, or close-fitting size.
4. Tell customers to choose the largest size indicated by any applicable measurement and to size up when between sizes.
5. Tell customers to measure over the base layers and plastron they expect to wear.
6. Add waist and hip to the women's jacket chart.
7. Label all adult numeric variants as European sizes and show body measurements next to the size.
8. Add a temporary `Runs small - review the chart and size up when between sizes` notice to women's apparel and kids' jackets while physical validation is in progress.

#### Immediate: Supplier Clarification

1. Ask whether women's size-38 waist should be 68-72 cm rather than 68-76 cm.
2. Ask why each supplier women's waist range is approximately 4 cm larger than Allstar's range for the same numbered size.
3. Ask whether the garments have separate short, regular, and tall patterns or whether length is intentionally tied to girth size.
4. Request finished-garment specifications, grading rules, allowed production tolerances, and the intended wearing ease for jackets and pants.
5. Confirm the kids' size-170 waist and the added adult-equivalent labels `(40)`, `(42)`, and `(44)`.

#### Physical Inventory Audit

Measure at least three units from each high-risk size when inventory permits:

- Women's jackets and pants: 36, 38, and 50
- Kids' jackets: 146, 152, 158, 164, and 170
- Men's jacket: 58
- Men's pants: 54

For jackets, record garment chest, waist, hip, sleeve length, torso length, arm opening, and label. For pants, record relaxed and stretched waist, hip, rise, thigh, inseam, and label. Compare units within the same SKU as well as against the supplier's finished-garment specification.

Do not replace the Novus chart with Allstar's chart without this audit. Allstar is a useful market benchmark, but it does not prove the dimensions of Novus garments.

#### Monitoring After Changes

1. Establish a change date and preserve pre-change results as the baseline.
2. Calculate return rates from gross shipped units by SKU and sales channel.
3. Track too-small and too-large returns separately.
4. Review results after at least 20 shipped units per major cohort, while continuing to investigate any repeated customer comments immediately.
5. Compare post-change results against the current baseline: 22.3% combined, 25.6% jackets, 18.4% pants, and 73.0% officially coded too small.

## Return Evidence

### Category Summary

| Category | Sales | Returns | Return rate | Too small | Too large | Other |
|---|---:|---:|---:|---:|---:|---:|
| Jackets | 90 | 23 | 25.6% | 16 | 4 | 3 |
| Pants | 76 | 14 | 18.4% | 11 | 2 | 1 |
| **Combined** | **166** | **37** | **22.3%** | **27** | **6** | **4** |

### Product Cohorts

| Product | Sales | Returns | Return rate | Too small | Too large | Other |
|---|---:|---:|---:|---:|---:|---:|
| Novus Men's Jacket 350N | 43 | 7 | 16.3% | 3 | 3 | 1 |
| Novus Women's Jacket 350N | 11 | 5 | **45.5%** | 4 | 1 | 0 |
| Novus Kids' Jacket 350N | 36 | 11 | **30.6%** | 9 | 0 | 2 |
| Novus Men's Pants 350N | 28 | 5 | 17.9% | 3 | 2 | 0 |
| Novus Women's Pants 350N | 4 | 3 | **75.0%** | 3 | 0 | 0 |
| Novus Kids' Pants 350N | 44 | 6 | 13.6% | 5 | 0 | 1 |

Women's sales volumes are small, so their percentages have wide uncertainty. The direction is nevertheless consistent: seven of eight women's returns were too small, and both size-38 right-handed products had two returns from two sales.

### Highest-Risk Variations

This table includes variations with at least two sales and at least one return. Rates based on two units should be treated as signals, not stable long-run estimates.

| Product | Variation | SKU | Sales | Returns | Return rate | Too small | Too large |
|---|---|---|---:|---:|---:|---:|---:|
| Novus Women's Pants 350N | 38 / Right | `fc-cpwn-rh-38` | 2 | 2 | **100.0%** | 2 | 0 |
| Novus Women's Jacket 350N | 38 / Right | `fc-cjwn-rh-38` | 2 | 2 | **100.0%** | 2 | 0 |
| Novus Women's Pants 350N | 36 / Right | `fc-cpwn-rh-36` | 2 | 1 | 50.0% | 1 | 0 |
| Novus Women's Jacket 350N | 50 / Right | `fc-cjwn-rh-50` | 2 | 1 | 50.0% | 1 | 0 |
| Novus Kids' Jacket 350N | 146 / Right | `fc-cjkn-rh-146` | 8 | 3 | 37.5% | 2 | 0 |
| Novus Kids' Jacket 350N | 152 / Right | `fc-cjkn-rh-152` | 5 | 2 | 40.0% | 2 | 0 |
| Novus Kids' Jacket 350N | 158 (40) / Right | `fc-cjkn-rh-158` | 7 | 2 | 28.6% | 2 | 0 |
| Novus Kids' Jacket 350N | 164 (42) / Right | `fc-cjkn-rh-164` | 2 | 1 | 50.0% | 1 | 0 |
| Novus Kids' Jacket 350N | 170 / Right | `fc-cjkn-rh-170` | 6 | 2 | 33.3% | 2 | 0 |
| Novus Kids' Pants 350N | 128 / Right | `fc-cpkn-rh-128` | 2 | 1 | 50.0% | 1 | 0 |
| Novus Kids' Pants 350N | 140 / Right | `fc-cpkn-rh-140` | 4 | 2 | 50.0% | 1 | 0 |
| Novus Kids' Pants 350N | 164 (42) / Left | `fc-cpkn-lh-164` | 2 | 1 | 50.0% | 1 | 0 |
| Novus Men's Jacket 350N | 44 / Right | `fc-cjmn-rh-44` | 4 | 2 | 50.0% | 1 | 1 |
| Novus Men's Jacket 350N | 48 / Right | `fc-cjmn-rh-48` | 6 | 2 | 33.3% | 1 | 0 |
| Novus Men's Jacket 350N | 58 / Left | `fc-cjmn-lh-58` | 2 | 1 | 50.0% | 1 | 0 |
| Novus Men's Pants 350N | 44 / Right | `fc-cpmn-rh-44` | 2 | 1 | 50.0% | 1 | 0 |
| Novus Men's Pants 350N | 48 / Right | `fc-cpmn-rh-48` | 3 | 1 | 33.3% | 1 | 0 |

### Customer Evidence

Several comments directly challenge the chart or garment labeling:

- Kids' jacket 146: the customer reported that chest and height were too small even though the chart indicated the garment should be larger than the child.
- Women's pants 38: the customer reported that the garment did not match the measurements.
- Women's jacket 50: the customer measured and ordered the closest size, but the torso and chest were too small.
- Men's jacket 58: the customer reported it was significantly smaller than an existing size-54 jacket and suspected mislabeling or incorrect sizing.
- Men's pants 54: the customer ordered above the stated waist and hip size but could not close the zipper.

These comments indicate that guidance changes alone may not be sufficient. Physical garment measurements and label verification are required.

## Definitive Mismatch Register

| Area | Fencing Club | Supplier | Allstar | Classification |
|---|---|---|---|---|
| Women's size 40 height | 158-164 | 164-170 | 164-170 regular | **Live transcription error** |
| Women's size 46 height | 164-170 | 170-176 | 164-170 regular | **Live transcription error; supplier also differs from Allstar** |
| Women's size 38 waist | 68-76 | 68-76 | 64-68 | **Probable supplier error and undersizing risk** |
| Women's waist, all sizes | Same as supplier | About 4 cm above Allstar | Lower range | **Systematic source discrepancy** |
| Women's height model | Width-linked bands | Width-linked bands | Separate short, regular, and tall families | **Different sizing methodology** |
| Women's jacket presentation | Chest and height only | Includes chest, waist, hip, and height | Includes all measurements | **Missing fit constraints** |
| Kids' size 170 waist | 68-72 | 68-72 | 65-69 | **Material source discrepancy** |
| Kids' `170 (44)` label | Added `(44)` in pants | `170` only | `170` | **Unverified equivalence** |
| Men's measurements | Matches supplier | Closely matches Allstar | Baseline | No systematic chart mismatch |

## Women's Comparison

### Chest

| Size | Fencing Club | Supplier | Allstar | Finding |
|---:|---:|---:|---:|---|
| 36 | 80-84 | 80-84 | 80-84 | Match |
| 38 | 84-88 | 84-88 | 84-88 | Match |
| 40 | 88-92 | 88-92 | 88-92 | Match |
| 42 | 92-96 | 92-96 | 92-96 | Match |
| 44 | 96-100 | 96-100 | 96-100 | Match |
| 46 | 100-104 | 100-104 | 100-104 | Match |
| 48 | 104-108 | 104-108 | 104-108 | Match |
| 50 | 108-112 | 108-112 | 108-116 | Allstar has a broader upper range |

### Waist

| Size | Fencing Club | Supplier | Allstar | Difference from Allstar |
|---:|---:|---:|---:|---|
| 36 | 64-68 | 64-68 | 60-64 | Supplier permits +4 cm |
| 38 | **68-76** | **68-76** | 64-68 | Supplier permits up to +8 cm and overlaps size 40 |
| 40 | 72-76 | 72-76 | 68-72 | Supplier permits +4 cm |
| 42 | 76-80 | 76-80 | 72-76 | Supplier permits +4 cm |
| 44 | 80-84 | 80-84 | 76-80 | Supplier permits +4 cm |
| 46 | 84-88 | 84-88 | 80-84 | Supplier permits +4 cm |
| 48 | 88-92 | 88-92 | 84-88 | Supplier permits +4 cm |
| 50 | 92-96 | 92-96 | 88-92 | Supplier permits +4 cm |

For example, a 75 cm waist can map to size 38 under the supplier chart but size 42 under Allstar. This is a two-size difference.

### Hip

| Size | Fencing Club | Supplier | Allstar | Finding |
|---:|---:|---:|---:|---|
| 36 | 87-91 | 87-91 | 87-91 | Match |
| 38 | 91-95 | 91-95 | 91-95 | Match |
| 40 | 95-99 | 95-99 | 95-99 | Match |
| 42 | 99-103 | 99-103 | 99-103 | Match |
| 44 | 103-107 | 103-107 | 103-107 | Match |
| 46 | 107-111 | 107-111 | 107-111 | Match |
| 48 | 111-115 | 111-115 | 111-115 | Match |
| 50 | 115-119 | 115-119 | 115-119 | Match |

### Height

| Size | Fencing Club | Supplier | Allstar regular | Finding |
|---:|---:|---:|---:|---|
| 36 | 158-164 | 158-164 | 164-170 | Live matches supplier |
| 38 | 158-164 | 158-164 | 164-170 | Live matches supplier |
| 40 | **158-164** | **164-170** | 164-170 | **Live transcription error** |
| 42 | 164-170 | 164-170 | 164-170 | Match |
| 44 | 164-170 | 164-170 | 164-170 | Match |
| 46 | **164-170** | **170-176** | 164-170 | **Live transcription error** |
| 48 | 170-176 | 170-176 | 164-170 | Live matches supplier, not Allstar regular |
| 50 | 170-176 | 170-176 | 164-170 | Live matches supplier, not Allstar regular |

## Men's Comparison

Men's chest, hip, and height measurements match across the live and supplier charts and align with Allstar. Supplier waist values differ from Allstar by no more than 1 cm at the smallest sizes.

| Size | FC/Supplier chest | Allstar chest | FC/Supplier waist | Allstar waist | FC/Supplier hip | Allstar hip |
|---:|---:|---:|---:|---:|---:|---:|
| 44 | 84-88 | 84-88 | 73-77 | 72-76 | 88-92 | 88-92 |
| 46 | 88-92 | 88-92 | 77-80 | 76-80 | 92-96 | 92-96 |
| 48 | 92-96 | 92-96 | 80-84 | 80-84 | 96-100 | 96-100 |
| 50 | 96-100 | 96-100 | 84-88 | 84-88 | 100-104 | 100-104 |
| 52 | 100-104 | 100-104 | 88-92 | 88-92 | 104-108 | 104-108 |
| 54 | 104-108 | 104-108 | 92-96 | 92-96 | 108-112 | 108-112 |
| 56 | 108-112 | 108-112 | 96-100 | 96-100 | 112-116 | 112-116 |
| 58 | 112-116 | 112-116 | 100-104 | 100-104 | 116-120 | 116-120 |
| 60 | 116-120 | 116-120 | 104-108 | 104-108 | 120-124 | 120-124 |

The men's return comments still justify physical measurement checks for label consistency and actual garment tolerance.

## Kids' Comparison

Sizes 128-164 match Allstar on height, chest, waist, and hip. Size 170 differs at the waist.

| Size | FC/Supplier waist | Allstar waist | Finding |
|---:|---:|---:|---|
| 128 | 58-62 | 58-62 | Match |
| 134 | 59-63 | 59-63 | Match |
| 140 | 60-64 | 60-64 | Match |
| 146 | 61-65 | 61-65 | Match |
| 152 | 62-66 | 62-66 | Match |
| 158 | 63-67 | 63-67 | Match |
| 164 | 64-68 | 64-68 | Match |
| 170 | **68-72** | **65-69** | Supplier permits up to +3 cm |

Despite strong chart alignment for sizes 128-164, kids' jackets show repeated too-small returns. This suggests garment dimensions, labeling, required ease, or measuring instructions are also contributing.

## Recommended Guidance

### General

> **How to choose your size**
>
> Measure over the clothing you expect to wear underneath. Keep the measuring tape level and comfortably snug without pulling it tight.
>
> Compare every applicable measurement in the chart. If different measurements indicate different sizes, choose the largest size indicated. If you fall between sizes, choose the larger size.
>
> Do not select a size from height or age alone. Height helps determine garment length, while chest, waist, and hip measurements determine fit.

### Jackets

> **Jackets**
>
> Measure around the fullest part of your chest, your natural waist, and the fullest part of your hips. Compare all three measurements with the chart and choose the largest size indicated.
>
> Measure over the base layer or plastron you expect to wear under the jacket. If you are between sizes, have broad shoulders, or prefer additional room through the arms and torso, choose the larger size.
>
> Use height as a secondary check for sleeve and torso length. Do not size down for a close fit.

### Pants

> **Pants**
>
> Measure your natural waist and the fullest part of your hips. Choose the larger size indicated by those measurements, then use height as a secondary check for garment length.
>
> Measure over any base layer you expect to wear. If you are between sizes or your waist and hip measurements indicate different sizes, choose the larger size for unrestricted movement while fencing.
>
> Do not choose the smaller size for a snug fit.

### Kids

> **Kids**
>
> Select size primarily from chest, waist, and hip measurements rather than age. Age is only a general reference.
>
> If measurements indicate different sizes, choose the largest size indicated. If the child is between sizes or still growing, choose the larger size.

## Recommended Actions

1. Correct women's size-40 height to 164-170 cm in jacket and pants tables.
2. Correct women's size-46 height to 170-176 cm in jacket and pants tables if following the supplier chart.
3. Ask the supplier whether women's size-38 waist should be 68-72 cm rather than 68-76 cm.
4. Ask why the supplier's women's waist mapping is consistently 4 cm larger than Allstar's for the same size.
5. Show waist and hip in the women's jacket chart.
6. Replace close-fit and size-down advice with the guidance above.
7. Verify the kids' size-170 waist and the added `170 (44)` equivalence.
8. Physically measure jackets and pants in high-return sizes, especially women's 36/38/50, kids' jackets 146-170, men's jacket 58, and men's pants 54.
9. Check labels against measured garment dimensions, especially the reported men's jacket 58 that appeared smaller than a size 54.
10. Recalculate return rates after enough post-change sales accrue; do not treat two-unit cohorts as stable estimates.

# Appendix A: Fencing Club Live Chart

Measurements are in centimeters. Jacket and pants tables are consolidated here.

## A1. Women

| Measurement | 36 | 38 | 40 | 42 | 44 | 46 | 48 | 50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Height | 158-164 | 158-164 | 158-164 | 164-170 | 164-170 | 164-170 | 170-176 | 170-176 |
| Chest | 80-84 | 84-88 | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 | 108-112 |
| Waist | 64-68 | 68-76 | 72-76 | 76-80 | 80-84 | 84-88 | 88-92 | 92-96 |
| Hip | 87-91 | 91-95 | 95-99 | 99-103 | 103-107 | 107-111 | 111-115 | 115-119 |

## A2. Men

| Measurement | 44 | 46 | 48 | 50 | 52 | 54 | 56 | 58 | 60 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Height | 164-170 | 164-170 | 170-176 | 170-176 | 176-182 | 176-182 | 176-182 | 182-188 | 182-188 |
| Chest | 84-88 | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 | 108-112 | 112-116 | 116-120 |
| Waist | 73-77 | 77-80 | 80-84 | 84-88 | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 |
| Hip | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 | 108-112 | 112-116 | 116-120 | 120-124 |

## A3. Kids

| Measurement | 128 | 134 | 140 | 146 | 152 | 158 (40) | 164 (42) | 170 (44) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Age | 7-8 | 8-9 | 9-10 | 10-11 | 11-12 | 12-13 | 13-14 | 15 |
| Height | 122-128 | 128-134 | 134-140 | 140-146 | 146-152 | 152-158 | 158-164 | 164-170 |
| Chest | 64-68 | 67-71 | 70-74 | 73-77 | 76-80 | 79-83 | 82-86 | 85-89 |
| Waist | 58-62 | 59-63 | 60-64 | 61-65 | 62-66 | 63-67 | 64-68 | 68-72 |
| Hip | 70-74 | 72-76 | 74-78 | 76-80 | 78-82 | 81-85 | 84-88 | 87-91 |

# Appendix B: Supplier Chart

Measurements are transcribed from the supplied image in centimeters.

## B1. Women

| Measurement | 36 | 38 | 40 | 42 | 44 | 46 | 48 | 50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Height | 158-164 | 158-164 | 164-170 | 164-170 | 164-170 | 170-176 | 170-176 | 170-176 |
| Chest | 80-84 | 84-88 | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 | 108-112 |
| Waist | 64-68 | 68-76 | 72-76 | 76-80 | 80-84 | 84-88 | 88-92 | 92-96 |
| Hip | 87-91 | 91-95 | 95-99 | 99-103 | 103-107 | 107-111 | 111-115 | 115-119 |

## B2. Men

| Measurement | 44 | 46 | 48 | 50 | 52 | 54 | 56 | 58 | 60 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Height | 164-170 | 164-170 | 170-176 | 170-176 | 176-182 | 176-182 | 176-182 | 182-188 | 182-188 |
| Chest | 84-88 | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 | 108-112 | 112-116 | 116-120 |
| Waist | 73-77 | 77-80 | 80-84 | 84-88 | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 |
| Hip | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 | 108-112 | 112-116 | 116-120 | 120-124 |

## B3. Kids

| Measurement | 128 | 134 | 140 | 146 | 152 | 158 (40) | 164 (42) | 170 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Age | 7-8 | 8-9 | 9-10 | 10-11 | 11-12 | 12-13 | 13-14 | 15 |
| Height | 122-128 | 128-134 | 134-140 | 140-146 | 146-152 | 152-158 | 158-164 | 164-170 |
| Chest | 64-68 | 67-71 | 70-74 | 73-77 | 76-80 | 79-83 | 82-86 | 85-89 |
| Waist | 58-62 | 59-63 | 60-64 | 61-65 | 62-66 | 63-67 | 64-68 | 68-72 |
| Hip | 70-74 | 72-76 | 74-78 | 76-80 | 78-82 | 81-85 | 84-88 | 87-91 |

# Appendix C: Official Allstar Chart

These are Allstar's regular sizes. Measurements are in centimeters.

## C1. Women

| Measurement | 34 | 36 | 38 | 40 | 42 | 44 | 46 | 48 | 50 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Height | 164-170 | 164-170 | 164-170 | 164-170 | 164-170 | 164-170 | 164-170 | 164-170 | 164-170 |
| Chest | 76-80 | 80-84 | 84-88 | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 | 108-116 |
| Waist | 56-60 | 60-64 | 64-68 | 68-72 | 72-76 | 76-80 | 80-84 | 84-88 | 88-92 |
| Hip | 83-87 | 87-91 | 91-95 | 95-99 | 99-103 | 103-107 | 107-111 | 111-115 | 115-119 |

## C2. Men

| Measurement | 44 | 46 | 48 | 50 | 52 | 54 | 56 | 58 | 60 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Height | 164-170 | 164-170 | 170-176 | 170-176 | 176-182 | 176-182 | 176-182 | 182-188 | 182-188 |
| Chest | 84-88 | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 | 108-112 | 112-116 | 116-120 |
| Waist | 72-76 | 76-80 | 80-84 | 84-88 | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 |
| Hip | 88-92 | 92-96 | 96-100 | 100-104 | 104-108 | 108-112 | 112-116 | 116-120 | 120-124 |

## C3. Kids

| Measurement | 128 | 134 | 140 | 146 | 152 | 158 | 164 | 170 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Height | 122-128 | 128-134 | 134-140 | 140-146 | 146-152 | 152-158 | 158-164 | 164-170 |
| Chest | 64-68 | 67-71 | 70-74 | 73-77 | 76-80 | 79-83 | 82-86 | 85-89 |
| Waist | 58-62 | 59-63 | 60-64 | 61-65 | 62-66 | 63-67 | 64-68 | 65-69 |
| Hip | 70-74 | 72-76 | 74-78 | 76-80 | 78-82 | 81-85 | 84-88 | 87-91 |

## C4. Allstar Height Families

### Women

| Family | Size numbers | Height |
|---|---|---:|
| Stocky/short | 18-25 | 158-164 |
| Regular | 34-50 | 164-170 |
| Tall | 72-100 | 170-176 |

### Men

| Family | Size numbers | Height progression |
|---|---|---|
| Stocky/short | 22-29 | 158-182 |
| Regular | 44-60 | 164-188 |
| Tall | 90-120 | 170-194 |
