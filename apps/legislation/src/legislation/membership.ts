export const organizationMembershipEndReasons = [
  "roster_removal_detected",
  "congress_ended",
  "historical_at_first_observation"
] as const

export type OrganizationMembershipEndReason = (typeof organizationMembershipEndReasons)[number]

export function isOrganizationMembershipEndReason(value: string): value is OrganizationMembershipEndReason {
  return organizationMembershipEndReasons.some((reason) => reason === value)
}
