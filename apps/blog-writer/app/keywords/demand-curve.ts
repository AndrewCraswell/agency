/** One month of measured demand, as the provider reports it. */
export type MonthlyDemand = { year: number; month: number; searchVolume: number }

/** Three months, which is the shortest span that is not one month's noise. */
const QUARTER = 3

/** A year of months, which is all the provider reports and the only span a season can be read from. */
const YEAR = 12

/** Puts the provider's months in order and keeps the most recent year of them. */
export function orderMonths(months: MonthlyDemand[] | null) {
  if (months === null) {
    return []
  }
  return [...months].sort((left, right) => left.year - right.year || left.month - right.month).slice(-YEAR)
}

/**
 * How demand has moved over the year and over the last quarter.
 *
 * Two spans rather than one, because a term whose year is up but whose last three months have rolled over is a term
 * whose moment has passed, and a single yearly figure cannot tell those apart. Both are ratios against the earlier
 * span, so a value above one is growth and the caller decides how much growth is worth acting on.
 */
export function demandTrend(months: MonthlyDemand[] | null) {
  const ordered = orderMonths(months)
  if (ordered.length < YEAR) {
    return { yearly: null, quarterly: null }
  }
  return {
    yearly: ratio(mean(ordered.slice(-QUARTER)), mean(ordered.slice(0, QUARTER))),
    quarterly: ratio(mean(ordered.slice(-QUARTER)), mean(ordered.slice(-QUARTER * 2, -QUARTER)))
  }
}

/**
 * The month demand peaks in, and how far away it is.
 *
 * The peak is measured against the year's median rather than its mean, because one enormous month drags a mean up far
 * enough to hide the season it belongs to. Lead time is counted forward from the current month, which is what decides
 * whether the answer is to write now or to schedule.
 */
export function seasonalPeak(months: MonthlyDemand[] | null, now: Date) {
  const ordered = orderMonths(months)
  if (ordered.length < YEAR) {
    return null
  }
  const middle = median(ordered.map((entry) => entry.searchVolume))
  if (middle === null || middle === 0) {
    return null
  }
  const peak = ordered.reduce((best, entry) => (entry.searchVolume > best.searchVolume ? entry : best))
  const currentMonth = now.getUTCMonth() + 1
  const monthsAhead = (peak.month - currentMonth + YEAR) % YEAR
  return { month: peak.month, searchVolume: peak.searchVolume, ratio: peak.searchVolume / middle, monthsAhead }
}

/** The name of a month, in the merchant's own language, for a row that has to be read rather than parsed. */
export function monthName(month: number, locale?: string) {
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(Date.UTC(2024, month - 1, 1))
}

function ratio(recent: number | null, earlier: number | null) {
  if (recent === null || earlier === null || earlier === 0) {
    return null
  }
  return recent / earlier
}

function mean(months: MonthlyDemand[]) {
  if (months.length === 0) {
    return null
  }
  return months.reduce((total, entry) => total + entry.searchVolume, 0) / months.length
}

function median(values: number[]) {
  if (values.length === 0) {
    return null
  }
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle] ?? 0
  if (sorted.length % 2 === 1) {
    return upper
  }
  return ((sorted[middle - 1] ?? upper) + upper) / 2
}
