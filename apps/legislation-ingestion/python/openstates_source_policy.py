"""Reviewed, exact-match changes applied only to the digest-verified upstream archive."""

from pathlib import Path

PATCHES = {
    "scrapers/wa/__init__.py": [
        ("settings = dict(SCRAPELIB_TIMEOUT=300)", "settings = dict(SCRAPELIB_TIMEOUT=60)"),
    ],
    "scrapers/wa/bills.py": [
        ("import requests\n", "import requests\nimport json\nfrom pathlib import Path\nfrom urllib.parse import urljoin, urlsplit, unquote\n"),
        ('''    def scrape(self, chamber=None, session=None):
        chambers = [chamber] if chamber else ["upper", "lower"]

        year = int(session[0:4])

        self._bill_id_list = self.get_prefiles(chamber, session, year)
        self.biennium = "%s-%s" % (session[0:4], session[7:9])

        for chamber in chambers:
            self.scrape_chamber(chamber, session)

        # uncomment the line below to scrape a single bill
        # self._bill_id_list = ["HB 1146"]

        # de-dup bill_id
        for bill_id in list(set(self._bill_id_list)):
            yield from self.scrape_bill(chamber, session, bill_id, year)
''', '''    def scrape(self, chamber=None, session=None, bill_ids=None):
        selected = bill_ids.split(",") if isinstance(bill_ids, str) else []
        if (session != "2025-2026" or not 1 <= len(selected) <= 10
                or any(not re.fullmatch(r"[HS](?:B|CR|JM|JR|R) [1-9][0-9]{0,4}", value) for value in selected)
                or len(set(selected)) != len(selected) or len({value[0] for value in selected}) != 1):
            raise ValueError("invalid_bill_batch")
        selected_chamber = "lower" if selected[0].startswith("H") else "upper"
        if chamber is not None and chamber != selected_chamber:
            raise ValueError("invalid_bill_chamber")
        self.biennium = "2025-26"
        self.versions = {}
        self.documents = {}
        # Discovery is frozen by the coordinator, never repeated as an unbounded child scrape.
        self._load_versions(selected_chamber)
        self._load_documents(selected_chamber)
        for bill_id in sorted(selected):
            yield from self.scrape_bill(selected_chamber, session, bill_id, 2025)
'''),
        ('base_url = "http://lawfilesext.leg.wa.gov/Biennium/"',
         'base_url = "https://lawfilesext.leg.wa.gov/Biennium/"'),
        ('                "http://lawfilesext.leg.wa.gov/Biennium/"',
         '                "https://lawfilesext.leg.wa.gov/Biennium/"'),
        ('''        self.documents = {}

        document_types''', '''        self.documents = {}
        directory_coverage = []

        document_types'''),
        ('''                doc = self.lxmlize(base_url + chamber + " " + bill_type)
            except scrapelib.HTTPError:
                return
''', '''                doc = self.lxmlize(base_url + chamber + " " + bill_type)
            except scrapelib.HTTPError:
                raise
'''),
        ('''            try:
                doc = self.lxmlize(url)
            except scrapelib.HTTPError:
                return
''', '''            parent_url = url.rsplit("/", 2)[0] + "/"
            parent = self.lxmlize(parent_url)
            expected_path = unquote(urlsplit(parent_url).path)
            if expected_path not in parent.xpath("string(//h1)"):
                raise ValueError("unrecognized_document_directory")
            advertised = {
                unquote(urlsplit(urljoin(parent_url, href)).path)
                for href in parent.xpath("//a/@href")
                if urlsplit(urljoin(parent_url, href)).netloc == urlsplit(parent_url).netloc
            }
            available = unquote(urlsplit(url).path) in advertised
            directory_coverage.append({"parent_url": parent_url, "directory_url": url, "advertised": available})
            if not available:
                continue
            doc = self.lxmlize(url)
'''),
        ('''    def get_prefiles(self, chamber, session, year):
''', '''        coverage_path = Path("_data/wa/document_directories.json")
        coverage_path.parent.mkdir(parents=True, exist_ok=True)
        coverage_path.write_text(json.dumps(directory_coverage), encoding="utf8")

    def get_prefiles(self, chamber, session, year):
'''),
        ('''            page = requests.get(url)
            page = lxml.etree.fromstring(page.content)
''', '''            page = requests.get(url, verify=True, timeout=(10, 60))
            page = lxml.etree.fromstring(page.content)
'''),
        ('''            page = requests.get(url)
        except requests.exceptions.HTTPError:
''', '''            page = requests.get(url, verify=True, timeout=(10, 60))
        except requests.exceptions.HTTPError:
'''),
    ],
    "scrapers/ak/events.py": [
        ('        r = requests.head(video_url)\n', '        r = requests.head(video_url, verify=True, timeout=(10, 60))\n'),
        ('''        page = self.get(url, params=args, headers=headers, verify=False)
        page = lxml.etree.fromstring(page.content)
        return page
''', '''        response = self.get(url, params=args, headers=headers, verify=True, timeout=(10, 60))
        response.raise_for_status()
        page = lxml.etree.fromstring(response.content)
        if page.xpath("//*[local-name()='Error']"):
            raise ValueError("alaska_meetings_source_error")
        return page
'''),
        ('''            building = "Alaska State Capitol, 120 4th St, Juneau, AK 99801"
            room_name = location
''', '''            building = None
            room_name = location
'''),
        ('''        if room_name:
            # Combine room name with building address for full address
            location = f"{room_name.upper()}, {building}"
        else:
            # No room name, so just use building address
            location = building
''', '''        # Preserve the publisher's location, including an unknown/empty value.
        # An inferred building is not evidence of where the meeting occurred.
        location = row.xpath("string(Location)").strip()
'''),
        ('self.tsbldg_room_re.match(location).group(1).title()', 'location'),
        ('self.anch_lio_room_re.match(location).group(1).title()', 'location'),
        ('''        event_name = f"{name}#{location}#{start_date}"
        event = Event(
            start_date=start_date, name=name, location_name=location, status=status
''', '''        # This is a source occurrence key, not proof of continuity after rescheduling.
        event_name = f"{row.xpath('string(chamber)')}:{committee_code}:{start_date.isoformat()}"
        event = Event(
            upstream_id=event_name,
            start_date=start_date, name=name, location_name=location, status=status
'''),
        ('''                    self.warning(f"Duplicate event: {name}")
                    continue
''', '''                    raise ValueError("duplicate_alaska_meeting_occurrence")
'''),
        ("%Y-%m-%d%%20%H:00:00", "%Y-%m-%d%%20%H:%M:%S"),
        ("import requests\n", "import requests\nfrom urllib.parse import quote\n"),
        ("{committee_code}%20", "{quote(committee_code, safe='')}%20"),
        ("        yield event, event_name\n", "        if not location:\n            event.location.pop('name', None)\n        yield event, event_name\n"),
        ("import pytz\n", "import pytz\nimport json\nfrom pathlib import Path\nfrom .meeting_partition import partition_meetings\n"),
        ("    def scrape(self, chamber=None, session=None, date_filter=None):\n", '''    def scrape(self, chamber=None, session=None, date_filter=None, event_keys=None):
        selected = event_keys.split(",") if isinstance(event_keys, str) else []
        if session != "34" or date_filter is not None or not 1 <= len(selected) <= 10 or len(set(selected)) != len(selected):
            raise ValueError("invalid_event_batch")
'''),
        ('''        events_xml = page.xpath("//Meeting")
''', '''        rows = page.xpath("//Meeting")
        records = []
        for row in rows:
            raw_chamber = row.xpath("string(chamber)").strip()
            sponsor = row.xpath("string(Sponsor)").strip()
            scheduled = dateutil.parser.parse(row.xpath("string(Schedule)"))
            if raw_chamber not in self.CHAMBERS or not sponsor or scheduled.tzinfo is None:
                raise ValueError("invalid_alaska_meeting_identity")
            key = f"{raw_chamber}:{sponsor}:{scheduled.isoformat()}"
            records.append((key, lxml.etree.tostring(row)))
        accepted, report = partition_meetings(records)
        accepted_by_key = {}
        for value in accepted:
            row = lxml.etree.fromstring(value)
            key = f"{row.xpath('string(chamber)').strip()}:{row.xpath('string(Sponsor)').strip()}:{dateutil.parser.parse(row.xpath('string(Schedule)')).isoformat()}"
            accepted_by_key[key] = value
        if not set(selected).issubset(accepted_by_key):
            raise ValueError("selected_meeting_missing_or_quarantined")
        report["selected_occurrences"] = sorted(selected)
        report_path = Path("_data/ak/meeting_partition.json")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report), encoding="utf8")
        events_xml = [lxml.etree.fromstring(accepted_by_key[key]) for key in sorted(selected)]
''')
    ],
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
        ("import datetime\n", "import datetime\nfrom urllib.parse import parse_qs, urlencode, urlsplit\n"),
        ("from . import actions\n", "from . import actions\nfrom .journal import journal_text, merge_adjacent_journal_text, parse_roll_call\n"),
        ('            if re.search(r"Y(\\d+)", action):\n',
         '            if re.search(r"Y(\\d+)", action) and not re.search(r"\\bP\\d+\\b", action):\n'),
        ("        vote.add_source(url)\n", '''        vote.add_source(url)
        response = self.get(url, timeout=(10, 60))
        response.raise_for_status()
        journal = lxml.html.fromstring(response.text)
        text = journal_text(journal)
        parsed_url = urlsplit(url)
        anchor = parsed_url.fragment or None
        page_values = parse_qs(parsed_url.query, keep_blank_values=True).get("Page", [])
        bill_values = parse_qs(parsed_url.query, keep_blank_values=True).get("Bill", [])
        page_anchor = (str(int(page_values[0])) if len(page_values) == 1
                       and re.fullmatch(r"0*[1-9][0-9]{0,9}", page_values[0]) else None)
        source_bill_scoped = (len(bill_values) == 1
                              and re.sub(r"\\s+", "", bill_values[0]).upper() == bill.identifier.upper())
        try:
            positions = parse_roll_call(
                text, bill.identifier, (yes, no, other), anchor, page_anchor, source_bill_scoped, action
            )
        except ValueError as error:
            if str(error) != "journal_roll_call_missing_or_ambiguous" or page_anchor is None:
                raise
            # A roll-call heading can begin at the bottom of the cited printed
            # page while its tally and names continue on the next page. Fetch
            # exactly that adjacent page; the parser still requires one exact
            # bill/tally match and complete named positions across both pages.
            next_query = parse_qs(parsed_url.query, keep_blank_values=True)
            next_query["Page"] = [str(int(page_anchor) + 1)]
            next_url = parsed_url._replace(query=urlencode(next_query, doseq=True), fragment="").geturl()
            next_response = self.get(next_url, timeout=(10, 60))
            next_response.raise_for_status()
            next_text = journal_text(lxml.html.fromstring(next_response.text))
            positions = parse_roll_call(
                merge_adjacent_journal_text(text, next_text, str(int(page_anchor) + 1)),
                bill.identifier, (yes, no, other), anchor, page_anchor,
                source_bill_scoped, action
            )
        for option, name in positions:
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
        ('''vdoc.xpath("//div[@class='row ncga-row-no-gutters']")''',
         '''vdoc.xpath("//div[contains(concat(' ', normalize-space(@class), ' '), ' row ') and contains(concat(' ', normalize-space(@class), ' '), ' ncga-row-no-gutters ')][not(.//div[contains(concat(' ', normalize-space(@class), ' '), ' row ') and contains(concat(' ', normalize-space(@class), ' '), ' ncga-row-no-gutters ')])]")'''),
        ('                    vote_type = "abstain"\n', '                    vote_type = "not voting"\n'),
    ],
    "scrapers/nc/events.py": [
        ('''                if when < self._tz.localize(datetime.datetime.now()):
                    status = "passed"
''', '''                # Elapsed scheduled time is not evidence that a meeting occurred.
'''),
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
    (source / "scrapers/ak/meeting_partition.py").write_bytes(Path(__file__).with_name("alaska_meeting_partition.py").read_bytes())
