"""Parse source-only roll-call names; never resolve people or infer vote outcomes."""

import re

SUMMARY = re.compile(r"YEAS:\s*(\d+)\s+NAYS:\s*(\d+)\s+EXCUSED:\s*(\d+)\s+ABSENT:\s*(\d+)")
GROUP = re.compile(r"^(Yeas|Nays|Excused|Absent):\s*(.*)$")
BILL = re.compile(r"(?:CS)?(HJR|SJR|HCR|SCR|HB|SB|HR|SR)\s*0*([1-9][0-9]*)(?![0-9])")
OPTIONS = {"Yeas": "yes", "Nays": "no", "Excused": "excused", "Absent": "absent"}
PAGE_HEADER = re.compile(r"(?:\d{4}-\d{2}-\d{2}\s+(?:House|Senate) Journal|Page \d+)")
ANCHOR = re.compile(r"\[\[JOURNAL_ANCHOR:([A-Za-z0-9_.:-]{1,100})\]\]")


def voter_names(lines):
    return [name.strip() for name in " ".join(lines).split(",") if name.strip()]


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


def parse_roll_call(text, bill_identifier, expected_counts, target_anchor=None):
    """Require a unique bill/tally match and complete disjoint named positions.

    Multiple same-tally motions on a journal page are deliberately ambiguous.
    Unknown formatting fails the batch instead of publishing partial voter lists.
    """
    if len(text) > 2 * 1024 * 1024:
        raise ValueError("journal_size_limit")
    expected_bill = re.sub(r"\s+", "", bill_identifier).upper()
    search_start = 0
    search_end = len(text)
    if target_anchor is not None:
        if not isinstance(target_anchor, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,100}", target_anchor):
            raise ValueError("journal_anchor_invalid")
        anchors = list(ANCHOR.finditer(text))
        selected = [index for index, match in enumerate(anchors) if match.group(1).casefold() == target_anchor.casefold()]
        if len(selected) != 1:
            raise ValueError("journal_anchor_missing_or_ambiguous")
        selected_index = selected[0]
        search_start = anchors[selected_index].end()
        for later in anchors[selected_index + 1:]:
            name = re.sub(r"\s+", "", later.group(1)).upper()
            # Bill and printed-page anchors are references inside one journal action.
            if name.isdigit() or BILL.fullmatch(name):
                continue
            search_end = later.start()
            break
    summaries = list(SUMMARY.finditer(text, search_start, search_end))
    candidates = []
    for index, summary in enumerate(summaries):
        totals = tuple(int(value) for value in summary.groups())
        if (totals[0], totals[1], totals[2] + totals[3]) != tuple(expected_counts):
            continue
        previous_end = summaries[index - 1].end() if index else 0
        references = list(BILL.finditer(text[max(previous_end, summary.start() - 1500):summary.start()]))
        if not references or "".join(references[-1].groups()) != expected_bill:
            continue
        end = summaries[index + 1].start() if index + 1 < len(summaries) else search_end
        candidates.append((totals, text[summary.end():end]))
    if len(candidates) != 1:
        raise ValueError("journal_roll_call_missing_or_ambiguous")
    totals, body = candidates[0]
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
            if PAGE_HEADER.fullmatch(line):
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
    if not 1 <= len(positions) <= 60:
        raise ValueError("journal_invalid_chamber_count")
    return positions
