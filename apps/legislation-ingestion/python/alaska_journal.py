"""Parse source-only roll-call names; never resolve people or infer vote outcomes."""

import re

SUMMARY = re.compile(r"YEAS:\s*(\d+)\s+NAYS:\s*(\d+)\s+EXCUSED:\s*(\d+)\s+ABSENT:\s*(\d+)")
JOINT_SUMMARY = re.compile(
    r"TOTALS?:\s*(\d+)\s+YEAS:\s*(\d+)\s+NAYS:\s+EXCUSED:\s*(\d+)\s+ABSENT:\s*(\d+)"
)
GROUP = re.compile(r"^(Yeas|Nays|Excused|Absent):\s*(.*)$")
BILL = re.compile(r"(?:CS)?(HJR|SJR|HCR|SCR|HB|SB|HR|SR)\s*0*([1-9][0-9]*)(?![0-9])")
OPTIONS = {"Yeas": "yes", "Nays": "no", "Excused": "excused", "Absent": "absent"}
PAGE_HEADER = re.compile(r"(?:\d{4}-\d{2}-\d{2}\s+(?:House|Senate) Journal|Page \d+)")
ANCHOR = re.compile(r"\[\[JOURNAL_ANCHOR:([A-Za-z0-9_.:-]{1,100})\]\]")


def voter_names(lines):
    return [name.strip() for name in " ".join(lines).split(",") if name.strip()]


def anchor_identity(value):
    """Compare printed-page anchors numerically while preserving named anchors."""
    return str(int(value)) if value.isdigit() else value.casefold()


def is_printed_page_anchor(text, match):
    name = match.group(1)
    if not name.isdigit():
        return False
    following = text[match.end():match.end() + 100]
    return re.match(r"\s*Page\s+0*" + re.escape(str(int(name))) + r"(?![0-9])", following) is not None


def printed_page_at(text, anchors, offset):
    pages = [match for match in anchors if match.start() < offset and is_printed_page_anchor(text, match)]
    return anchor_identity(pages[-1].group(1)) if pages else None


def motion_matches(hint, context):
    if hint is None:
        return True
    hint = re.sub(r"\s+", " ", hint).upper()
    context = re.sub(r"\s+", " ", context).upper()
    # The journal can finish the previous motion after its tally and before the
    # next question. Classify the candidate from the most recent explicit
    # question when one is published, so a nearby prior amendment number or
    # procedural verb cannot be mistaken for this roll call's subject.
    question = context.rfind("THE QUESTION BEING:")
    if question >= 0:
        context = context[question:]
    nested_amendment = re.search(
        r"\bAM\s*(?:NO\.?\s*)?(\d+)\s+TO\s+AM\s*(?:NO\.?\s*)?(\d+)\b", hint
    )
    if nested_amendment:
        return re.search(
            rf"\bAMENDMENT\s+TO\s+AMENDMENT\s+NO\.?\s*{int(nested_amendment.group(2))}\b",
            context,
        ) is not None
    amendment = re.search(r"\bAM\s*(?:NO\.?\s*)?(\d+)\b", hint)
    if amendment and not re.search(
        rf"\bAM(?:ENDMENT)?\s*(?:NO\.?\s*)?{int(amendment.group(1))}\b", context
    ):
        return False
    if "CBRF" in hint:
        return re.search(
            r"THE QUESTION BEING:\s*[\"']?SHALL THE [^?]{0,120}"
            r"\bCONSTITUTIONAL BUDGET RESERVE",
            context,
        ) is not None
    if "EFFECTIVE DATE" in hint:
        return "EFFECTIVE DATE" in context
    waive_rule = re.search(r"\bWAIVE (?:UNIFORM )?RULE\s+(\d+)\b", hint)
    if waive_rule:
        return re.search(
            rf"\b(?:SUSPEND|WAIVE) (?:UNIFORM )?RULE\s+{int(waive_rule.group(1))}\b",
            context,
        ) is not None
    if "CONCUR" in hint:
        if "THE QUESTION BEING:" in context:
            return re.search(
                r"THE QUESTION BEING:\s*[\"']?SHALL THE [^?]{0,120}\bCONCUR\b",
                context,
            ) is not None
        return "CONCUR" in context and "EFFECTIVE DATE" not in context
    if "PASSED ON RECONSIDERATION" in hint:
        return ("FINAL PASSAGE RECONSIDERATION" in context
                or "THIRD READING - ON RECONSIDERATION" in context
                or re.search(r"\bPASS THE (?:HOUSE|SENATE)\b", context) is not None)
    if "RECON SAME DAY" in hint:
        return re.search(r"\bTAKE UP RECONSIDERATION (?:ON (?:THE )?)?SAME DAY\b", context) is not None
    if re.fullmatch(r"\([HS]\)\s+PASSED(?:\s+[YNEA](?:\d+|-))*", hint):
        return "FINAL PASSAGE" in context
    if "NOT TABLED" in hint:
        return "NOT TABLED" in context or "/TABLE" in context
    if re.search(r"\bAM\s*(?:NO\.?\s*)?\d+(?:\s+AS\s+AMD)?\s+TABLED\b", hint):
        return ("WAS TABLED" in context or "/TABLE" in context) and "NOT TABLED" not in context
    if "WITHDRAW" in hint:
        return "WITHDRAW" in context
    if "RESCIND" in hint:
        return "RESCIND" in context
    if "RULED OUT OF ORDER" in hint:
        return "OUT OF ORDER" in context
    if "RESCIND" in context or "RESCINDED" in context:
        return False
    if "WITHDRAW" in context:
        return False
    if "NOT TABLED" in context or re.search(r"\bTABLED?\b", context):
        return False
    if "OUT OF ORDER" in context:
        return False
    return True


def parse_positions(body, totals):
    groups = {}
    active = None
    declared = dict(zip(OPTIONS, totals))
    for line in body.splitlines():
        line = line.strip()
        match = GROUP.fullmatch(line)
        if match:
            active = match.group(1)
            if active in groups:
                raise ValueError("journal_duplicate_voter_group")
            groups[active] = [match.group(2)]
        elif not line:
            # Printed page boundaries include blank text nodes. Continue only
            # while the active source group is still short of its declared tally.
            if active is not None and len(voter_names(groups[active])) >= declared[active]:
                active = None
        elif active is not None:
            # The HTML can split one printed header into date/journal and page fragments.
            if PAGE_HEADER.fullmatch(line) or ANCHOR.fullmatch(line):
                continue
            if len(voter_names(groups[active])) < declared[active]:
                groups[active].append(line)
            else:
                active = None
    positions = []
    seen = set()
    for (label, option), count in zip(OPTIONS.items(), totals):
        names = voter_names(groups.get(label, []))
        if len(names) != count:
            raise ValueError("journal_voter_count_mismatch")
        for name in names:
            key = re.sub(r"\s+", "", name).casefold()
            if key in seen or not re.fullmatch(r"[^\W\d_][^\d:;\n]{0,99}", name):
                raise ValueError("journal_duplicate_or_invalid_voter")
            seen.add(key)
            positions.append((option, name))
    return positions


def journal_text(document):
    """Preserve named source anchors while converting the journal HTML to text."""
    pres = document.xpath("//pre")
    if len(pres) != 1:
        raise ValueError("journal_pre_missing_or_ambiguous")
    for anchor in pres[0].xpath(".//a[@name]"):
        name = anchor.get("name", "")
        if re.fullmatch(r"[A-Za-z0-9_.:-]{1,100}", name):
            anchor.text = f"\n[[JOURNAL_ANCHOR:{name}]]\n" + (anchor.text or "")
    return "\n".join(pres[0].xpath(".//text()"))


def merge_adjacent_journal_text(primary, adjacent, page_number):
    """Join adjacent publisher responses without duplicating an overlap page."""
    if (not isinstance(primary, str) or not isinstance(adjacent, str)
            or not isinstance(page_number, str) or not re.fullmatch(r"[1-9][0-9]{0,9}", page_number)):
        raise ValueError("journal_overlap_invalid")
    identity = anchor_identity(page_number)
    primary_matches = [match for match in ANCHOR.finditer(primary)
                       if anchor_identity(match.group(1)) == identity
                       and is_printed_page_anchor(primary, match)]
    adjacent_matches = [match for match in ANCHOR.finditer(adjacent)
                        if anchor_identity(match.group(1)) == identity
                        and is_printed_page_anchor(adjacent, match)]
    if len(adjacent_matches) != 1 or len(primary_matches) > 1:
        raise ValueError("journal_overlap_missing_or_ambiguous")
    if len(primary_matches) == 1:
        return primary[:primary_matches[0].start()] + adjacent[adjacent_matches[0].start():]
    previous_identity = str(int(page_number) - 1)
    previous_matches = [match for match in ANCHOR.finditer(primary)
                        if anchor_identity(match.group(1)) == previous_identity
                        and is_printed_page_anchor(primary, match)]
    if len(previous_matches) != 1:
        raise ValueError("journal_overlap_missing_or_ambiguous")
    return primary.rstrip() + "\n" + adjacent[adjacent_matches[0].start():]


def parse_roll_call(text, bill_identifier, expected_counts, target_anchor=None, fallback_anchor=None,
                    source_bill_scoped=False, motion_hint=None):
    """Require a unique bill/tally match and complete disjoint named positions.

    Multiple same-tally motions on a journal page are deliberately ambiguous.
    Unknown formatting fails the batch instead of publishing partial voter lists.
    """
    if len(text) > 2 * 1024 * 1024:
        raise ValueError("journal_size_limit")
    expected_bill = re.sub(r"\s+", "", bill_identifier).upper()
    anchors = list(ANCHOR.finditer(text))
    search_ranges = [(0, len(text), None, None, False, False)]
    if target_anchor is not None:
        if not isinstance(target_anchor, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,100}", target_anchor):
            raise ValueError("journal_anchor_invalid")
        selected = [index for index, match in enumerate(anchors)
                    if anchor_identity(match.group(1)) == anchor_identity(target_anchor)]
        if not selected and fallback_anchor is not None:
            if not isinstance(fallback_anchor, str) or not re.fullmatch(r"[1-9][0-9]{0,9}", fallback_anchor):
                raise ValueError("journal_fallback_anchor_invalid")
            selected = [index for index, match in enumerate(anchors)
                        if anchor_identity(match.group(1)) == anchor_identity(fallback_anchor)]
            target_anchor = fallback_anchor
        if not selected:
            raise ValueError("journal_anchor_missing_or_ambiguous")
        search_ranges = []
        for selected_index in selected:
            search_start = anchors[selected_index].end()
            search_end = len(text)
            preferred_end = None
            cited_offset = None
            backward_start = None
            # A numeric fragment identifies the printed page where an action
            # starts. A voter list can continue onto the immediately following
            # printed page, but later pages contain independent motions whose
            # identical tallies must not create false ambiguity.
            if target_anchor.isdigit():
                cited_offset = anchors[selected_index].start()
                prior_pages = [earlier for earlier in anchors[:selected_index]
                               if is_printed_page_anchor(text, earlier)]
                if prior_pages:
                    backward_start = prior_pages[-1].end()
                later_pages = [later for later in anchors[selected_index + 1:]
                               if is_printed_page_anchor(text, later)]
                if len(later_pages) >= 2:
                    search_end = later_pages[1].start()
            else:
                target_amendment = re.fullmatch(r"AM([1-9][0-9]*)", target_anchor.upper())
                for later in anchors[selected_index + 1:]:
                    if preferred_end is None and is_printed_page_anchor(text, later):
                        preferred_end = later.start()
                    name = re.sub(r"\s+", "", later.group(1)).upper()
                    # Bill and printed-page anchors are references inside one journal action.
                    if name.isdigit() or BILL.fullmatch(name):
                        continue
                    later_amendment = re.fullmatch(r"AM([1-9][0-9]*)", name)
                    if target_amendment and later_amendment:
                        # Cross a lower-numbered anchor only when the publisher
                        # explicitly identifies it as an amendment to this
                        # amendment. A later ordinary lower-numbered amendment
                        # starts a separate action and must end the range.
                        nearby = re.sub(r"\s+", " ", text[
                            max(search_start, later.start() - 500):min(len(text), later.end() + 500)
                        ]).upper()
                        nearby = re.sub(r"\[\[JOURNAL_ANCHOR:[^\]]+\]\]", " ", nearby)
                        nested = re.search(
                            rf"AMENDMENT\s+NO\.\s*{int(later_amendment.group(1))}\s+TO\s+"
                            rf"AMENDMENT\s+NO\.\s*{int(target_amendment.group(1))}\b",
                            nearby,
                        )
                        if nested:
                            continue
                    search_end = later.start()
                    break
            search_ranges.append((search_start, search_end, preferred_end, None, False, False))
            if backward_start is not None:
                search_ranges.append((backward_start, search_end, preferred_end, cited_offset, True, False))
        # The publisher can reuse a named amendment fragment from an earlier
        # page without emitting that anchor again for a later reconsideration.
        # Search the URL's cited printed page as a bounded alternative to the
        # named fragment. Some journals reuse a stale amendment fragment, while
        # others put the fragment on the following printed page after the action
        # has begun. Repeated named fragments remain ambiguous and must not be
        # rescued by this fallback.
        if fallback_anchor is not None and not target_anchor.isdigit() and len(selected) == 1:
            fallback_pages = [match for match in anchors
                              if anchor_identity(match.group(1)) == anchor_identity(fallback_anchor)
                              and is_printed_page_anchor(text, match)]
            for fallback_page in fallback_pages:
                later_pages = [later for later in anchors if later.start() > fallback_page.start()
                               and is_printed_page_anchor(text, later)]
                fallback_end = later_pages[1].start() if len(later_pages) >= 2 else len(text)
                search_ranges.append((fallback_page.end(), fallback_end, None, None, False, True))
    candidates = []
    cited_candidates = []
    for (search_start, search_end, preferred_end, cited_offset, backward_only,
         cited_range) in search_ranges:
        range_candidates = []
        summaries = sorted(
            [*SUMMARY.finditer(text, search_start, search_end),
             *JOINT_SUMMARY.finditer(text, search_start, search_end)],
            key=lambda match: match.start(),
        )
        for index, summary in enumerate(summaries):
            if backward_only and (cited_offset is None or summary.start() >= cited_offset):
                continue
            totals = tuple(int(value) for value in summary.groups())
            if (totals[0], totals[1], totals[2] + totals[3]) != tuple(expected_counts):
                continue
            is_joint_total = summary.re is JOINT_SUMMARY or bool(re.search(
                r"TOTALS?:\s*$", text[max(search_start, summary.start() - 40):summary.start()]
            ))
            # Numeric page anchors can follow the bill heading they identify.
            previous_end = summaries[index - 1].end() if index else max(0, search_start - 1500)
            references = list(BILL.finditer(text[max(previous_end, summary.start() - 1500):summary.start()]))
            referenced_bills = {"".join(reference.groups()) for reference in references}
            if not is_joint_total and expected_bill not in referenced_bills and not source_bill_scoped:
                continue
            end = summaries[index + 1].start() if index + 1 < len(summaries) else search_end
            if backward_only and not summary.start() < cited_offset < end:
                continue
            # A later motion can begin after this voter list but before the next
            # tally. Classify from the bounded pre-tally action text so its
            # descriptor cannot be contaminated by the following motion.
            # The source pads journal lines to a fixed display width, so a raw
            # character window can contain mostly whitespace and omit the
            # nearby motion descriptor. Bound semantic matching by normalized
            # text instead, while retaining enough raw input to cross the
            # preceding printed-page boundary when an action spans pages.
            semantic_floor = (0 if ((target_anchor is not None and target_anchor.isdigit())
                                    or cited_range) else search_start)
            context_start = (summaries[index - 1].end() if index else
                             max(semantic_floor, summary.start() - 12000))
            candidate_context = re.sub(
                r"\s+", " ", text[context_start:summary.end()]
            )[-1500:]
            if not motion_matches(motion_hint, candidate_context):
                continue
            if is_joint_total:
                # Joint veto actions publish complete House and Senate roll calls,
                # followed by a source total without another voter list. Accept the
                # total only when the two immediately preceding calls independently
                # validate and sum exactly to it.
                if index < 2:
                    continue
                components = []
                for component_index in (index - 2, index - 1):
                    component = summaries[component_index]
                    component_totals = tuple(int(value) for value in component.groups())
                    component_previous_end = (summaries[component_index - 1].end()
                                              if component_index else max(0, search_start - 1500))
                    component_references = list(BILL.finditer(
                        text[max(component_previous_end, component.start() - 1500):component.start()]
                    ))
                    if (expected_bill not in {"".join(reference.groups()) for reference in component_references}
                            and not source_bill_scoped):
                        components = []
                        break
                    component_end = summaries[component_index + 1].start()
                    try:
                        positions = parse_positions(text[component.end():component_end], component_totals)
                    except ValueError:
                        components = []
                        break
                    components.append((component_totals, positions))
                if (len(components) == 2
                        and tuple(sum(component[0][offset] for component in components) for offset in range(4)) == totals):
                    combined = components[0][1] + components[1][1]
                    if len({re.sub(r"\s+", "", name).casefold() for _, name in combined}) != len(combined):
                        raise ValueError("journal_duplicate_or_invalid_voter")
                    candidate_page = printed_page_at(text, anchors, summary.start())
                    if cited_offset is not None and summary.start() < cited_offset < end:
                        candidate_page = anchor_identity(target_anchor)
                    elif cited_range:
                        candidate_page = anchor_identity(fallback_anchor)
                    range_candidates.append((summary.start(), candidate_page, combined))
            else:
                try:
                    candidate_page = printed_page_at(text, anchors, summary.start())
                    positions = parse_positions(text[summary.end():end], totals)
                    if backward_only:
                        try:
                            parse_positions(text[summary.end():cited_offset], totals)
                        except ValueError:
                            pass
                        else:
                            # The voter list was already complete before the
                            # cited page, so this is a prior action rather than
                            # a cross-page continuation.
                            continue
                        candidate_page = anchor_identity(target_anchor)
                    elif cited_range:
                        candidate_page = anchor_identity(fallback_anchor)
                    range_candidates.append((summary.start(), candidate_page,
                                             positions))
                except ValueError:
                    continue
        cited_page = anchor_identity(fallback_anchor) if fallback_anchor is not None else None
        cited = [candidate for candidate in range_candidates if candidate[1] == cited_page]
        preferred = ([candidate for candidate in range_candidates if candidate[0] < preferred_end]
                     if preferred_end is not None else [])
        if cited:
            cited_candidates.extend((offset, positions) for offset, _, positions in cited)
        else:
            selected_candidates = preferred or range_candidates
            if target_anchor is not None and target_anchor.isdigit() and selected_candidates:
                selected_candidates = selected_candidates[:1]
            candidates.extend((offset, positions) for offset, _, positions in selected_candidates)
    if cited_candidates:
        candidates = cited_candidates
    candidates = list({offset: positions for offset, positions in candidates}.values())
    if len(candidates) != 1:
        raise ValueError("journal_roll_call_missing_or_ambiguous")
    positions = candidates[0]
    if not 1 <= len(positions) <= 60:
        raise ValueError("journal_invalid_chamber_count")
    return positions
