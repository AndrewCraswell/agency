"""Reviewed, exact-match changes applied only to the digest-verified upstream archive."""

from pathlib import Path

PATCHES = {
    "scrapers/ak/__init__.py": [
        ("settings = dict(SCRAPELIB_TIMEOUT=600)", "settings = dict(SCRAPELIB_TIMEOUT=60)")
    ],
    "scrapers/ak/bills.py": [
        ("    def scrape(self, chamber=None, session=None):\n", '''    def scrape(self, chamber=None, session=None, bill_ids=None):
        selected = bill_ids.split(",") if isinstance(bill_ids, str) else []
        if (session != "34" or not 1 <= len(selected) <= 10
                or any(not re.fullmatch(r"[HS](?:B|R|JR|J|CR|SC|SCR)[1-9][0-9]{0,4}", item) for item in selected)
                or len(set(selected)) != len(selected)
                or len({item[0] for item in selected}) != 1):
            raise ValueError("invalid_bill_batch")
'''),
        ('''        for bill_link in doc.xpath("//tr//td[1]//nobr[1]//a[1]"):
''', '''        indexed = {}
        for candidate in doc.xpath("//tr//td[1]//nobr[1]//a[1]"):
            identifier = (candidate.text or "").replace(" ", "")
            if identifier in selected:
                if identifier in indexed:
                    raise ValueError("duplicate_selected_bill")
                indexed[identifier] = candidate
        if set(indexed) != set(selected):
            raise ValueError("missing_selected_bill")
        for identifier in selected:
            bill_link = indexed[identifier]
'''),
        ("from . import actions\n", "from . import actions\nfrom .journal import parse_roll_call\n"),
        ("        vote.add_source(url)\n", '''        vote.add_source(url)
        response = self.get(url, timeout=(10, 60))
        response.raise_for_status()
        journal = lxml.html.fromstring(response.text)
        text = "\\n".join(journal.xpath("//pre//text()"))
        for option, name in parse_roll_call(text, bill.identifier, (yes, no, other)):
            vote.vote(option, name)
''')
    ],
    "scrapers/nc/bills.py": [
        ('dt.datetime.strptime(date.replace(".", ""), "%m/%d/%Y %H:%M %p")',
         'dt.datetime.strptime(date.replace(".", ""), "%m/%d/%Y %I:%M %p")'),
        ('''    def scrape(self, session=None, chamber=None):
        chambers = [chamber] if chamber else ["upper", "lower"]

        if session in ["1997", "1999"]:
            self.scrape_archived_votes("upper", session)
            self.scrape_archived_votes("lower", session)

        for chamber in chambers:
            yield from self.scrape_chamber(chamber, session)
''', '''    def scrape(self, session=None, bill_ids=None):
        # NC pilot batches are explicit bill identifiers, never moving feed offsets.
        selected = bill_ids.split(",") if isinstance(bill_ids, str) else []
        if (session != "2025" or not 1 <= len(selected) <= 10
                or any(not re.fullmatch(r"[HS][1-9][0-9]{0,4}", item) for item in selected)
                or len(set(selected)) != len(selected)
                or len({item[0] for item in selected}) != 1):
            raise ValueError("invalid_bill_batch")
        chamber = "upper" if selected[0][0] == "S" else "lower"
        yield from self.scrape_chamber(chamber, session, selected)
'''),
        ("    def scrape_chamber(self, chamber, session):\n", "    def scrape_chamber(self, chamber, session, selected):\n"),
        ('''        for item in data[0][4:]:
            bill_id = item[1].text
            bill_type = item[7].text
            bill_title = item[4].text
''', '''        indexed = {}
        for item in data[0][4:]:
            bill_id = item[1].text
            if bill_id in selected:
                if bill_id in indexed:
                    raise ValueError("duplicate_selected_bill")
                indexed[bill_id] = item
        if set(indexed) != set(selected):
            raise ValueError("missing_selected_bill")
        for bill_id in sorted(selected, key=lambda item: int(item[1:])):
            item = indexed[bill_id]
            bill_type = item[7].text
            bill_title = item[4].text
'''),
    ],
    "scrapers/nc/events.py": [
        ('''                event = Event(
                    name=com_name,
''', '''                notice_urls = row.xpath('.//a[contains(@href,"/Committees/NoticeDocument/")]/@href')
                notice_ids = {re.fullmatch(r"https://www\\.ncleg\\.gov/Committees/NoticeDocument/([1-9][0-9]*)/[^?#]+", link).group(1)
                              for link in notice_urls
                              if re.fullmatch(r"https://www\\.ncleg\\.gov/Committees/NoticeDocument/([1-9][0-9]*)/[^?#]+", link)}
                if len(notice_ids) != 1:
                    raise ValueError("missing_or_ambiguous_meeting_notice")
                notice_id = next(iter(notice_ids))
                event = Event(
                    upstream_id=notice_id,
                    name=com_name,
'''),
        ("                event.add_source(com_url)\n", "                event.add_source(com_url)\n                event.add_source(notice_urls[0])\n"),
        ("    verify = False\n", "    verify = True\n"),
        ("                            bill_resp = requests.get(bill_url)\n",
         "                            bill_resp = self.get(bill_url, verify=True, timeout=(10, 60))\n"
         "                            bill_resp.raise_for_status()\n"),
    ],
    "scrapers/utils/lxmlize.py": [
        ("    res = requests.get(url, verify=verify, headers=headers)\n",
         "    res = requests.get(url, verify=True, headers=headers, timeout=(10, 60))\n"
         "    res.raise_for_status()\n"),
        ('''        try:
            # This class is always mixed into subclasses of `Scraper`,
            # which have a `get` method defined.
            response = self.get(url, verify=verify, headers=headers)
        except requests.exceptions.SSLError:
            self.warning(
                "`self.lxmlize()` failed due to SSL error, trying "
                "an unverified `self.get()` (i.e. `requests.get()`)"
            )
            response = self.get(url, verify=False, headers=headers)

        if raise_exceptions:
            response.raise_for_status()
''', '''        # Certificate failures must stop extraction, never trigger an insecure retry.
        response = self.get(url, verify=True, headers=headers, timeout=(10, 60))
        response.raise_for_status()
'''),
    ],
}


def harden_source(source):
    """Fail closed on source drift; retain original source in the pinned tar archive."""
    for relative, replacements in PATCHES.items():
        path = source / relative
        content = path.read_text(encoding="utf8")
        for before, after in replacements:
            if content.count(before) != 1:
                raise ValueError("source_policy_target_mismatch:" + relative)
            content = content.replace(before, after)
        path.write_bytes(content.encode("utf8"))
    # Included in the generated file manifest and verified again during image build.
    (source / "scrapers/ak/journal.py").write_bytes(Path(__file__).with_name("alaska_journal.py").read_bytes())
