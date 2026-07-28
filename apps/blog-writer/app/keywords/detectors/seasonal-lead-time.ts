import { monthName, seasonalPeak } from "../demand-curve"
import type { Detector } from "../types"
import { candidate, clearsDemandFloor, demand } from "./support"

/**
 * How far the peak has to stand above the year's ordinary month.
 *
 * Half again the median is high enough that the peak is a season rather than the natural wobble of a small sample.
 * Below it, writing for the peak is writing for noise.
 */
const PEAK_RATIO = 1.5

/** The peak has to be far enough out that an article can be written, published, and found before it arrives. */
const MINIMUM_LEAD_MONTHS = 2

/** Past this the peak is next year's problem, and a merchant told about it now will have forgotten by then. */
const MAXIMUM_LEAD_MONTHS = 5

/**
 * Demand for this subject peaks in a month that is close enough to write for and far enough away to still make.
 *
 * The verdict is to schedule rather than to write, because the value here is entirely in the timing: the same article
 * published a week after the peak is worth a fraction of the same article published a month before it.
 *
 * One year of history shows a peak but cannot show that it repeats, so the evidence names the peak actually measured
 * rather than claiming a pattern. Retained imports are what eventually turn one observation into one.
 */
export const seasonalLeadTime: Detector = {
  name: "seasonal_lead_time",
  verdict: "schedule",
  requiresAuthority: false,
  detect: (clusters, { calibration, now }) =>
    clusters.flatMap((cluster) => {
      if (!clearsDemandFloor(cluster, calibration.demandFloor)) {
        return []
      }
      const peak = seasonalPeak(cluster.headMonthlySearches, now)
      if (peak === null || peak.ratio < PEAK_RATIO) {
        return []
      }
      if (peak.monthsAhead < MINIMUM_LEAD_MONTHS || peak.monthsAhead > MAXIMUM_LEAD_MONTHS) {
        return []
      }
      return [
        candidate("seasonal_lead_time", cluster, "schedule", [
          `Demand for "${cluster.headKeyword}" peaks in ${monthName(peak.month)} at ${demand(peak.searchVolume)} searches.`,
          `That's ${peak.ratio.toFixed(1)} times an ordinary month, and it's ${String(peak.monthsAhead)} months away.`,
          "This is one year of measured demand, so it names the peak we saw rather than a pattern we've confirmed."
        ])
      ]
    })
}
