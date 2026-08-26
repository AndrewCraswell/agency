# Scoring specifications

This directory separates normative and project specification inputs from implementation notes and public prior art.

## Rules and protocol sources

| Document | Role | Source and integrity |
| --- | --- | --- |
| [`fie-material-rules-2026-08-en.pdf`](fie-material-rules-2026-08-en.pdf) | Normative FIE Material Rules, Book 3, August 2026 | [FIE rules index](https://fie.org/documents/rules), [official PDF](https://static.fie.org/uploads/40/204157-book%20material%20August%202026%20ang.pdf), SHA-256 `1489D28ED6F3C91E27ECDF75BB29B4ED65C688A012F544D37D946A9DA81AFC26` |
| [`fie-traceability-matrix.md`](fie-traceability-matrix.md) | Local article-to-requirement decomposition | Derived from the pinned August 2026 FIE PDF; the PDF remains authoritative |
| [`protocols/cyrano-protocol-1.0-2008-12-05.pdf`](protocols/cyrano-protocol-1.0-2008-12-05.pdf) | Historical EFP1/Cyrano 1.0 provenance only; not a product implementation target | [Public Ophardt mirror](https://docs.ophardt.online/images/9/96/Cyrano_1.0.pdf), SHA-256 `ACBCF1CBF857429CF9FA64558E3B1C3EEDC9ACF1F891177E8471C1938B663828` |
| [`protocols/cyrano-protocol-1.1-2019-10-11.pdf`](protocols/cyrano-protocol-1.1-2019-10-11.pdf) | EFP1.1/Cyrano 1.1 protocol, adding P-card and centisecond fields | [Public protocol mirror](https://superfencingsystem.com/CyranoProtocol-1-1.pdf), SHA-256 `D422342D83072C8EC38DB6E0403C741ED6A82A08095510AFD499568E26C5C0C3` |
| [`protocols/rs422-fpa-protocol-3.04a-2019-05-21.pdf`](protocols/rs422-fpa-protocol-3.04a-2019-05-21.pdf) | Latest publicly located Fencing Piste Apparatus RS422 output protocol; covers the electrical layer, messages 1-9, refresh scheduling, and receiver validation | [Super Fencing System protocol mirror](https://superfencingsystem.com/RS422-FPA-V3.04a.pdf), SHA-256 `E76B97A2B701D83323F22B9A7C42C3D053ED4FF0DF7163BCB1AB43EE97B50A91` |
| [`protocols/fencing-time-scoring-machine-integration-guide.pdf`](protocols/fencing-time-scoring-machine-integration-guide.pdf) | Fencing Time 4.6 vendor integration guide, August 2024; covers Cyrano 1.0/1.1 setup, bout exchange, Fencing Time Live, data forwarding, and StripView | [Fencing Time PDF](https://fencingtime.s3.amazonaws.com/FencingTimeScoringMachineIntegrationGuide.pdf), SHA-256 `494532474DBF541F6019D6C36D507E1CE81E4D274D780D622515A27F2223D255` |
| [`protocols/fie-fencing-radio-specifications-rev2.0.pdf`](protocols/fie-fencing-radio-specifications-rev2.0.pdf) | FIE basic radio specification for a separate wireless clock Start/Stop system; requires two remotes, selectable sub-GHz frequencies, acknowledgement, monitoring, encryption, and less-than-100-ms latency | [Official FIE PDF](https://static.fie.org/uploads/8/44449-Fencing%20Radio%20specifications%20Rev2.0.pdf), SHA-256 `1C4E1F3BB9C1F491E4C3ABCC0AD39F7423FC8DDDA1E734FD0C9F65EE6DF44E4A` |

The Cyrano PDFs identify their protocol authors and FIE/manufacturer working-group history, but the files above were
retrieved from public mirrors because a current FIE-hosted protocol download was not located. Preserve their hashes and
treat any implementation ambiguity as unresolved until it is checked against interoperable apparatus and tournament
software.

The proposed product implements EFP1.1 only. It does not advertise, negotiate, or fall back to Cyrano 1.0/EFP1. The
older PDF is retained solely as historical protocol provenance.

The FIE radio document describes a minimal 810-960 MHz Start/Stop clock system with main and backup remotes. It does
not describe the full-function infrared handhelds supplied with the commercial apparatus reviewed here. The proposed
product therefore keeps encrypted IR as its primary referee remote and treats a separate FIE radio subsystem as a
homologation clarification with SEMI, not as a baseline product claim.

The current Super Fencing System protocol index still identifies RS422-FPA 3.04a as its FPA specification, and no
newer public revision was located on August 24, 2026. The pinned PDF is a public community-protocol mirror, not evidence
that this project is FIE-homologated or certified interoperable. Recheck the source index and test against target
apparatus and receivers before freezing a production implementation.

## Integration evidence

The Fencing Time guide is vendor documentation for configuring a supported scoring machine with Fencing Time Scoring
Device Manager. It is evidence for Fencing Time's expected network configuration and workflow, but the Cyrano PDFs above
remain the message-level protocol inputs. Compatibility still requires an interoperability test against the current
Fencing Time release; the guide does not make this project's implementation certified or supported by Fencing Time.

Super Fencing System publishes a [current protocol and machine compatibility table](https://superfencingsystem.com/protocols.html)
and advertises native Cyrano UDP support on its [product page](https://superfencingsystem.com/). No separate general
Super Fencing System app-integration manual was located on August 24, 2026. Its downloadable manuals describe the
SFS-Link hardware adapters for Favero serial or RS422-FPA sources, not native Cyrano integration. For native Ethernet
integration, use the pinned Cyrano 1.1 PDF above as the implementation input and treat successful operation with the
current Super Fencing System app as a separate test gate.

## Product specification

[`proposed-product-specification.md`](proposed-product-specification.md) defines the proposed commercial product,
feature priorities, hardware and power architecture, inputs and outputs, scoring authority, protocol directions,
remote controls, firmware responsibilities, recovery, faults, and minimum conformance work. It is a product proposal,
not a schematic release or homologation claim.

[`weapon-scoring-programming-specification.md`](weapon-scoring-programming-specification.md) consolidates the required
foil, epee, and sabre state-machine behavior. Normative FIE requirements, released project decisions, and prior-art
observations remain explicitly distinguished.

[`scoring-calculation-implementation-guide.md`](scoring-calculation-implementation-guide.md) translates that baseline
into code-facing definitions and exact calculations for candidates, qualification, resistance uncertainty, foil
classification, epee double touches, weapon lockout, sabre whip-over, diagnostics, and output latching. Each weapon table
identifies whether behavior comes from FIE or a deterministic project selection and links to pinned prior-art code
blocks. Its appendices provide implementation pseudocode without copying the cited repositories.

## Commercial manuals and feature baseline

The [`manuals`](manuals/) directory preserves the official Favero apparatus/repeater documents, the Virtual Scoring
Machine program manual, and the Skewered Fencing manual snapshot used for product comparison. Its manifest records
source URLs, page counts, hashes, and the important distinction between Skewered's native HTML manual and its separate
PDF quick-start guide.

[`commercial-scoring-machine-feature-catalog.md`](commercial-scoring-machine-feature-catalog.md) assigns stable feature
IDs to the documented weapon modes, bout workflow, diagnostics, remotes, protocols, repeaters, update paths, power, and
mechanical capabilities. These are competitive/product inputs; they become project requirements only through an
explicit decision and never override the FIE rules.

## Prior art

The [`prior-art`](prior-art/) directory contains the commit-pinned GitHub repository catalog and its comparison against
the FIE-derived requirements. The
[`open-source-commercial-feature-gap-analysis.md`](prior-art/open-source-commercial-feature-gap-analysis.md) also maps
the retained competitive public references to the commercial feature IDs and prioritizes missing scoring, workflow,
interoperability, diagnostics, and recovery evidence. Public code is evidence of earlier implementation approaches, not
a normative authority.
