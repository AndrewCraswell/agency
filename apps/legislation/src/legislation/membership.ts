export const organizationMembershipEndReasons = ["roster_removal_detected", "congress_ended"] as const

export type OrganizationMembershipEndReason = (typeof organizationMembershipEndReasons)[number]

export function isOrganizationMembershipEndReason(value: string): value is OrganizationMembershipEndReason {
  return organizationMembershipEndReasons.some((reason) => reason === value)
}
