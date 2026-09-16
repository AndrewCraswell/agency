"""Bounded federal XML normalization. No network, credentials, or database access.

Original Rostra implementation against official source XML, not copied Vaquill code.
Raw XML blocks are evidence, never trusted HTML. Output stays staged until TS validation.
"""
from __future__ import annotations

import argparse
from collections import Counter
from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import re
import sys
import time
import xml.etree.ElementTree as ET
from xml.parsers import expat

CONTRACT = "regulatory-xml-2026-09-14"
FR_KINDS = {"RULE": "final_rule", "PRORULE": "proposed_rule", "NOTICE": "notice"}
ANNUAL_KINDS = {"TITLE", "SUBTITLE", "CHAPTER", "SUBCHAP", "PART", "SUBPART", "SUBJGRP", "SECTION", "APPENDIX"}
TOC_TAGS = {"TOC", "CFRTOC", "CONTENTS", "TITLENO", "FMTR", "BMTR"}
BREAK_TAGS = {"P", "FP", "PSPACE", "HD", "HEAD", "HED", "ROW", "TR", "SECTNO", "SUBJECT", "FRDOC", "LI"}

# Reviewed against the official printed volume, pp. 39, 43 and 45, and its contents.
# See docs/regulations/annual-title5-source-review.md. Never generalize this to
# unreviewed revisions: another source hash must retain the normal scope gate.
TITLE5_VOLUME2_HASH = "f698bb1a9b200dd7a35846e93f119b96c02e66785226e73d3644a8fab61b88c7"


def reviewed_fr_identity(context: dict, path: str, number: str):
    # Both official documents print 00-113. Citation/page and original locator,
    # never input order or mixed API metadata, distinguish these observations.
    # See docs/regulations/fr-source-identities.md for the printed-page review.
    if (context["unit"]["nativeId"], context["artifactHash"], number) != (
        "FR-2000-01-18", "5c8fa553adc3c2c5b041ac8b1b1cc6cac1edd4945111037bd4f4fbf574566201", "00-113"
    ):
        return None
    return {
        "/FEDREG[1]/RULES[1]/RULE[5]": "fr:2000-01-18:65:2537:rule",
        "/FEDREG[1]/NOTICES[1]/NOTICE[62]": "fr:2000-01-18:65:2639:notice",
    }.get(path)


def reviewed_parent_paths(context: dict) -> dict[str, str]:
    unit = context["unit"]
    if (unit["sourceId"], unit["nativeId"], context["artifactHash"]) != (
        "govinfo-cfr", "CFR-2025-title5-vol2", TITLE5_VOLUME2_HASH
    ):
        return {}
    subchapter = "/CFRDOC[1]/TITLE[1]/CHAPTER[1]/SUBCHAP[1]"
    part = subchapter + "/PART[7]"
    revision_a = part + "/SUBPART[1]/SECTION[6]/EFFDNOTP[1]/REVTXT[1]"
    subpart_b = revision_a + "/SUBPART[2]"
    revision_b = subpart_b + "/SECTION[6]/EFFDNOTP[1]/REVTXT[1]"
    return {
        subpart_b: part,
        **{f"{revision_b}/SUBPART[{index}]": part for index in range(2, 6)},
        **{f"{revision_b}/PART[{index}]": subchapter for index in range(1, 41)},
    }


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def text_of(element: ET.Element) -> str:
    pieces = []

    def visit(node):
        if node.tag in BREAK_TAGS:
            pieces.append("\n")
        pieces.append(node.text or "")
        for child in node:
            visit(child)
            pieces.append(child.tail or "")
        if node.tag in {"TD", "TH", "ENT"}:
            pieces.append("\t")
        if node.tag in BREAK_TAGS:
            pieces.append("\n")

    visit(element)
    lines = [re.sub(r"[ \r\f\v]+", " ", line).strip() for line in "".join(pieces).split("\n")]
    return "\n".join(line for line in lines if line).strip()


def date_from_words(value: str):
    match = re.search(r"\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})\b", value)
    if match is None:
        return None
    from datetime import date
    months = "January February March April May June July August September October November December".split()
    return date(int(match[3]), months.index(match[1]) + 1, int(match[2])).isoformat()


@dataclass
class Frame:
    element: ET.Element
    path: str
    is_record: bool
    key: str | None
    parent_key: str | None
    ordinal: int | None
    namespaces: dict
    logical_parent: Frame | None = None
    children: Counter = field(default_factory=Counter)
    retained_bytes: int = 0
    retained_elements: int = 1


class Shards:
    def __init__(self, output: Path, limits: dict):
        self.output = output
        self.limits = limits
        self.files = []
        self.handle = None
        self.records = 0
        self.total_bytes = 0
        self.file_bytes = 0
        self.file_records = 0
        self.hash = None
        self.name = None

    def close(self):
        if self.handle is not None:
            self.handle.flush()
            self.handle.close()
            self.files.append({"file": self.name, "bytes": self.file_bytes, "records": self.file_records, "sha256": self.hash.hexdigest()})
            self.handle = None

    def write(self, record):
        encoded = (json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")
        if len(encoded) > self.limits["maximumRecordBytes"]:
            raise ValueError("Normalized record exceeds byte limit")
        if self.total_bytes + len(encoded) > self.limits["maximumOutputBytes"] or self.records >= self.limits["maximumRecords"]:
            raise ValueError("Normalized output exceeds limit")
        if self.handle is not None and (self.file_records >= 5000 or self.file_bytes + len(encoded) > 16 * 1024 * 1024):
            self.close()
        if self.handle is None:
            self.name = f"records-{len(self.files):05d}.ndjson"
            self.handle = (self.output / self.name).open("xb")
            self.hash = hashlib.sha256()
            self.file_bytes = self.file_records = 0
        self.handle.write(encoded)
        self.hash.update(encoded)
        self.file_bytes += len(encoded)
        self.total_bytes += len(encoded)
        self.file_records += 1
        self.records += 1


class FederalParser:
    def __init__(self, context: dict, shards: Shards):
        self.context = context
        self.unit = context["unit"]
        self.source = self.unit["sourceId"]
        self.limits = context["limits"]
        self.shards = shards
        self.stack = []
        self.tags = Counter()
        self.kinds = Counter()
        self.native_ids = set()
        self.source_records = 0
        self.maximum_depth = 0
        self.warnings = []
        self.source_dates = []
        self.title_roots = 0
        self.quoted_scope_warning = False
        self.quoted_structure_count = 0
        self.parent_corrections = reviewed_parent_paths(context)
        self.applied_parent_corrections = set()
        title_match = re.search(r"title-?(\d+)", self.unit["nativeId"])
        self.title_number = title_match[1] if title_match else None

    def is_record(self, tag: str, attrs: dict, ancestors: list[Frame]):
        if self.source == "ecfr":
            if re.fullmatch(r"DIV\d+", tag) is not None:
                is_empty_group = attrs.get("TYPE") == "SUBJGRP" and attrs.get("EMPTY") == "true" and attrs.get("N") == ""
                if not attrs.get("TYPE") or (not attrs.get("N") and not is_empty_group):
                    raise ValueError("eCFR structural node lacks type or native number")
                return True
            return False
        if self.source == "govinfo-fr":
            return tag in FR_KINDS
        # Publisher effective-date notes quote replacement sections/subparts. Preserve those quotes
        # inside the enclosing provision; they are not additional current-code identities.
        in_revision = any(frame.element.tag in {"REVTXT", "EFFDNOTP"} for frame in ancestors)
        if in_revision and tag in ANNUAL_KINDS:
            self.quoted_structure_count += 1
        if in_revision and (tag in {"TITLE", "CHAPTER", "SUBCHAP"} or self.quoted_structure_count >= 100) and not self.quoted_scope_warning:
            self.quoted_scope_warning = True
            self.warnings.append({"code": "quoted_revision_scope_review", "sourceLocator": self.stack[-1].path,
                                  "detail": "Quoted revision contains title/chapter structure or at least 100 structural nodes; review source nesting before publishing."})
        return tag in ANNUAL_KINDS and not in_revision and not any(frame.element.tag in TOC_TAGS for frame in ancestors)

    def start(self, tag, attrs):
        if len(self.stack) >= self.limits["maximumDepth"] or len(attrs) > 256:
            raise ValueError("XML depth or attribute limit exceeded")
        if not self.stack:
            expected = {"ecfr": {"ECFR", "DLPSTEXTCLASS"}, "govinfo-fr": {"FEDREG"}, "govinfo-cfr": {"CFRDOC"}}
            if tag not in expected[self.source]:
                raise ValueError("Unexpected federal XML root")
        namespaces = dict(self.stack[-1].namespaces) if self.stack else {}
        namespaces.update({key: value for key, value in attrs.items() if key == "xmlns" or key.startswith("xmlns:")})
        if self.stack:
            parent = self.stack[-1]
            parent.children[tag] += 1
            path = f"{parent.path}/{tag}[{parent.children[tag]}]"
        else:
            path = f"/{tag}[1]"
        logical_parent = self.stack[-1] if self.stack else None
        if path in self.parent_corrections:
            target = self.parent_corrections[path]
            logical_parent = next((frame for frame in self.stack if frame.path == target and frame.is_record), None)
            if logical_parent is None:
                raise ValueError("Reviewed source correction parent missing")
            self.applied_parent_corrections.add(path)
        ancestors = []
        ancestor = logical_parent
        while ancestor is not None:
            ancestors.append(ancestor)
            ancestor = ancestor.logical_parent
        is_record = self.is_record(tag, attrs, ancestors)
        parent_key = next((frame.key for frame in ancestors if frame.is_record), None)
        ordinal = self.source_records if is_record else None
        key = sha(f"{self.unit['key']}\n{path}".encode()) if is_record else None
        if is_record:
            self.source_records += 1
        frame = Frame(ET.Element(tag, attrs), path, is_record, key, parent_key, ordinal, namespaces,
                      logical_parent=logical_parent,
                      retained_bytes=len(tag.encode()) + sum(len(k.encode()) + len(v.encode()) for k, v in attrs.items()))
        self.stack.append(frame)
        self.tags[tag] += 1
        self.maximum_depth = max(self.maximum_depth, len(self.stack))

    def characters(self, value):
        if not self.stack:
            return
        frame = self.stack[-1]
        frame.retained_bytes += len(value.encode("utf-8"))
        self.check_bound(frame)
        if len(frame.element):
            last = frame.element[-1]
            last.tail = (last.tail or "") + value
        else:
            frame.element.text = (frame.element.text or "") + value

    def check_bound(self, frame):
        if frame.retained_bytes > self.limits["maximumNodeBytes"] or frame.retained_elements > self.limits["maximumNodeElements"]:
            raise ValueError("XML node exceeds retained size limit")

    def end(self, tag):
        frame = self.stack.pop()
        if tag == "REVISED" and self.source == "govinfo-cfr" and any(f.element.tag == "TITLEPG" for f in self.stack):
            self.record_date("printed_revision", text_of(frame.element), frame.path)
        if tag == "DATE" and self.source == "govinfo-fr" and len(self.stack) == 1:
            self.record_date("publication", text_of(frame.element), frame.path)
        if frame.is_record:
            self.emit(frame)
        elif self.stack:
            parent = self.stack[-1]
            parent.element.append(frame.element)
            parent.retained_bytes += frame.retained_bytes
            parent.retained_elements += frame.retained_elements
            self.check_bound(parent)

    def record_date(self, kind, raw_text, locator):
        value = date_from_words(raw_text)
        self.source_dates.append({"kind": kind, "value": value, "rawText": raw_text, "sourceLocator": locator})
        if value is None:
            self.warnings.append({"code": "unparsed_source_date", "sourceLocator": locator, "detail": raw_text})
        elif (kind == "printed_revision" and value[:4] != self.unit["edition"]) or (kind == "publication" and value != self.unit["issueDate"]):
            self.warnings.append({"code": "source_date_mismatch", "sourceLocator": locator,
                                  "detail": f"Listing edition {self.unit['edition']}; source {kind} {value}"})

    def emit(self, frame):
        node = frame.element
        kind = node.attrib.get("TYPE", node.tag).lower() if self.source == "ecfr" else node.tag.lower()
        heading_node = next((node.find(path) for path in ["HEAD", "HD", "SUBJECT", "PREAMB/SUBJECT", "CFRTITLE/TITLEHD/HD", "TOC/TOCHD/HD"] if node.find(path) is not None), None)
        heading = text_of(heading_node) if heading_node is not None else ""
        section_node = node.find("SECTNO")
        native_number = node.attrib.get("N")
        if self.source == "govinfo-cfr" and section_node is not None:
            native_number = re.sub(r"^\s*§+\s*", "", text_of(section_node)).strip()
            heading = (text_of(section_node) + " " + heading).strip()
        if kind == "title":
            self.title_roots += 1
            if self.source == "ecfr" and native_number != self.title_number:
                raise ValueError("eCFR title does not match acquisition unit")
        identity_basis = "source_locator"
        native_id = f"{self.unit['nativeId']}:{frame.path}"
        if kind == "section" and native_number:
            native_id = f"cfr:{self.title_number}:section:{native_number}"
            identity_basis = "citation"
        elif self.source == "ecfr" and native_number:
            ancestors = [(f.element.attrib.get("TYPE"), f.element.attrib.get("N")) for f in self.stack if f.is_record]
            native_id = "ecfr:" + json.dumps(ancestors + [(node.attrib.get("TYPE"), native_number)], separators=(",", ":"))
            identity_basis = "publisher_hierarchy"
        publication_kind = None
        if self.source == "govinfo-fr":
            publication_kind = FR_KINDS[node.tag]
            # Historical publisher XML varies bracket/case and omits space before the filing date.
            identities = [re.match(r"\s*\[?FR Doc\.\s+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)\s+Filed(?=\s|[0-9])", text_of(item), re.IGNORECASE) for item in node.findall("FRDOC")]
            if len(identities) != 1 or identities[0] is None:
                raise ValueError("Federal Register document lacks an unambiguous document number")
            native_id = identities[0][1]
            identity_basis = "document_number"
            citation_identity = reviewed_fr_identity(self.context, frame.path, native_id)
            if citation_identity is not None:
                native_id = citation_identity
                identity_basis = "citation"
        if native_id in self.native_ids:
            raise ValueError("Duplicate regulatory native identity")
        self.native_ids.add(native_id)
        blocks = []
        for child_index, child in enumerate(node):
            # Copy inherited namespace declarations onto independently retained XML blocks.
            for name, value in frame.namespaces.items():
                if name not in child.attrib:
                    child.set(name, value)
            tags = {element.tag for element in child.iter()}
            block_kind = "text"
            if tags & {"TABLE", "GPOTABLE"}: block_kind = "table"
            elif child.tag in {"AUTH", "AUTHORITY"}: block_kind = "authority"
            elif child.tag in {"HEAD", "HD", "HED", "SUBJECT", "SECTNO"}: block_kind = "heading"
            elif child.tag in {"FTNT", "FTNOTE"}: block_kind = "footnote"
            blocks.append({"ordinal": child_index, "tag": child.tag, "kind": block_kind,
                           "text": text_of(child), "xml": ET.tostring(child, encoding="unicode")})
        body = text_of(node)
        record = {"contract": CONTRACT, "recordType": "publication" if self.source == "govinfo-fr" else "provision",
                  "recordKey": frame.key, "parentKey": frame.parent_key, "ordinal": frame.ordinal,
                  "nativeId": native_id, "identityBasis": identity_basis, "nodeKind": kind,
                  "heading": heading, "text": body, "textHash": sha(body.encode("utf-8")), "blocks": blocks,
                  "publicationKind": publication_kind, "legalStatus": "unknown", "sourceLocator": frame.path,
                  "provenance": {"sourceId": self.source, "jurisdictionKey": "us", "acquisitionUnitId": self.unit["key"],
                                 "artifactHash": self.context["artifactHash"], "sourceUrl": self.unit["sourceUrl"],
                                 "publisherIssueDate": self.unit["issueDate"], "currencyDate": self.unit["currencyDate"],
                                 "edition": self.unit["edition"], "rightsProfileId": self.unit["rightsProfileId"]},
                  "sourceAttributes": dict(node.attrib)}
        self.shards.write(record)
        self.kinds[kind] += 1


def reject_external(*_args):
    raise ValueError("DTD and entity declarations are forbidden")


def parse_file(input_path: Path, output: Path, context: dict):
    started = time.perf_counter()
    if expat.version_info < (2, 6, 0):
        raise ValueError("Expat >= 2.6 is required for large-token protection")
    output.mkdir(parents=True, exist_ok=False)
    shards = Shards(output, context["limits"])
    collector = FederalParser(context, shards)
    parser = expat.ParserCreate()
    parser.buffer_text = True
    parser.StartElementHandler = collector.start
    parser.EndElementHandler = collector.end
    parser.CharacterDataHandler = collector.characters
    parser.StartDoctypeDeclHandler = reject_external
    parser.EntityDeclHandler = reject_external
    parser.ExternalEntityRefHandler = reject_external
    parser.SetParamEntityParsing(expat.XML_PARAM_ENTITY_PARSING_NEVER)
    input_hash = hashlib.sha256()
    input_bytes = 0
    try:
        with input_path.open("rb") as source:
            while chunk := source.read(64 * 1024):
                input_bytes += len(chunk)
                if input_bytes > context["limits"]["maximumInputBytes"]:
                    raise ValueError("XML input exceeds byte limit")
                input_hash.update(chunk)
                parser.Parse(chunk, False)
        parser.Parse(b"", True)
        if input_hash.hexdigest() != context["artifactHash"]:
            raise ValueError("XML artifact hash mismatch")
        if collector.applied_parent_corrections != set(collector.parent_corrections):
            raise ValueError("Reviewed source correction inventory mismatch")
        if collector.source_records != shards.records or shards.records == 0:
            raise ValueError("XML record completeness mismatch or empty supported corpus")
        if collector.source != "govinfo-fr" and collector.title_roots != 1:
            raise ValueError("Expected exactly one code title root")
        shards.close()
        report = {"contract": CONTRACT, "parserCodeHash": sha(Path(__file__).read_bytes()),
                  "inputHash": input_hash.hexdigest(), "inputBytes": input_bytes, "records": shards.records,
                  "sourceRecords": collector.source_records, "sourceElements": sum(collector.tags.values()),
                  "sourceTagCounts": dict(collector.tags), "countsByKind": dict(collector.kinds),
                  "maximumDepth": collector.maximum_depth, "shards": shards.files,
                  "warnings": collector.warnings, "sourceDates": collector.source_dates,
                  "elapsedSeconds": round(time.perf_counter() - started, 3), "expatVersion": expat.EXPAT_VERSION,
                  "canonicalWrites": False, "status": "parsed", "publicationReady": False}
        with (output / "summary.json").open("x", encoding="utf-8") as target:
            json.dump(report, target, ensure_ascii=False, indent=2)
        return report
    finally:
        shards.close()


def main():
    arguments = argparse.ArgumentParser()
    arguments.add_argument("--input", required=True)
    arguments.add_argument("--context", required=True)
    arguments.add_argument("--output", required=True)
    args = arguments.parse_args()
    context = json.loads(Path(args.context).read_text(encoding="utf-8"))
    report = parse_file(Path(args.input), Path(args.output), context)
    print(json.dumps({"status": report["status"], "records": report["records"]}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, expat.ExpatError, OSError, KeyError) as error:
        codes = {
            "Duplicate regulatory native identity": "duplicate_identity",
            "XML node exceeds retained size limit": "node_size_limit",
            "Normalized record exceeds byte limit": "record_size_limit",
            "Normalized output exceeds limit": "output_size_limit",
            "eCFR structural node lacks type or native number": "missing_native_identity",
            "DTD and entity declarations are forbidden": "forbidden_xml_declaration",
            "XML depth or attribute limit exceeded": "xml_depth_limit",
            "eCFR title does not match acquisition unit": "wrong_title",
            "Federal Register document lacks an unambiguous document number": "missing_document_number",
            "XML artifact hash mismatch": "artifact_hash_mismatch"
        }
        code = "malformed_xml" if isinstance(error, expat.ExpatError) else codes.get(str(error), "parser_failed")
        print(json.dumps({"status": "failed", "errorCode": code}), file=sys.stderr)
        sys.exit(1)
