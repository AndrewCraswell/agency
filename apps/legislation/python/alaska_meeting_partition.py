"""Conservative occurrence partitioning; retain all conflicting source variants."""


def partition_meetings(records):
    groups = {}
    for key, source_xml in records:
        if not isinstance(key, str) or not key or not isinstance(source_xml, bytes) or not source_xml:
            raise ValueError("invalid_meeting_partition_record")
        groups.setdefault(key, []).append(source_xml)
    accepted = []
    quarantined = []
    duplicate_rows = 0
    for key in sorted(groups):
        variants = sorted(set(groups[key]))
        if len(variants) == 1:
            accepted.append(variants[0])
            duplicate_rows += len(groups[key]) - 1
        else:
            quarantined.append({
                "occurrence_key": key,
                "reason": "conflicting_source_variants",
                "source_rows": [value.decode("utf8") for value in groups[key]],
            })
    return accepted, {"quarantined": quarantined, "exact_duplicate_rows": duplicate_rows,
                      "input_rows": sum(map(len, groups.values())), "accepted_occurrences": len(accepted),
                      "complete_snapshot": not quarantined}
