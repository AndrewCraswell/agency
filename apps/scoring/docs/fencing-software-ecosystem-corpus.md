# Fencing software ecosystem corpus

**Snapshot date:** 2026-08-24

**Scope:** purpose-built Olympic-sport fencing software, mobile apps, web apps, desktop tools, scoring-apparatus
software, tournament systems, video-refereeing systems, training tools, club software, public repositories, and research
prototypes

**Status policy:** status is metadata, not an inclusion filter

This document is a discovery corpus, not an adoption ranking or a claim that the ecosystem has a finite, enumerable
boundary. It deliberately retains production products, beta releases, discontinued commercial systems, dormant
repositories, source-available prototypes, and research systems. Regional app stores, private federation systems,
renamed products, and poorly indexed one-off hardware projects create unavoidable discovery gaps.

The inventory is broader than the scoring-apparatus repositories examined in
[the GitHub catalog](specifications/prior-art/fencing-scoring-github-catalog.md). Apparatus designs selected as engineering prior art are assessed
separately in [the scoring prior-art analysis](specifications/prior-art/fencing-scoring-prior-art-analysis.md). A listing here establishes only that
the named tool is part of the fencing software corpus; it is not evidence of adoption, fitness, security, rules
conformance, or current FIE approval.

## Classification

- **Production** means the product is deployed, sold, or presently store-listed.
- **Beta** means early access, waitlist, prototype, or an incomplete production transition.
- **Historical** means discontinued, dormant, superseded, archived, or no longer distributed.
- **OSS** means a recognizable open-source license was observed.
- **Public/no license** means source can be read but no reuse license was observed. Public visibility alone is not open
  source.
- **Source-available** means source is published under a restricted or non-OSI license.
- **Status uncertain** means the listing was found but present distribution or maintenance could not be established.

Tools appear under one primary category even when their feature set crosses several categories. Commercial products
without published source are recorded as proprietary or source-unknown rather than assumed to be open source.

## Tournament management, registration, results, and presentation

### Major tournament ecosystems

- **Engarde ecosystem** — Engarde, Engarde Smart, DiapoEngarde, ShowPiste, EngardeSwitch, Engarde Service, Atlas, and
  Skouting. Tournament management, displays, live results, video, and referee tooling. Production and proprietary, with
  Atlas historical. Sources: [Engarde](https://www.engarde-escrime.com/engarde),
  [documentation](https://www.engarde-escrime.com/documentation),
  [DiapoEngarde](https://www.engarde-escrime.com/diapoengarde), and
  [Engarde Service](https://engarde-service.com/about).
- **Fencing Time and Fencing Time Live** — Windows competition management and hosted live results. Production and
  proprietary. Sources: [Fencing Time Live](https://www.fencingtimelive.com/),
  [user guide](https://fencingtime.s3.amazonaws.com/FencingTimeUsersGuide.pdf), and the current
  [USA Fencing organizer workflow](https://www.usafencing.org/tournament-organizer-hub).
- **Fencing Fox ecosystem** — competition management, Diaporama displays, and Fox SmartApp. Production and
  proprietary. Sources: [Fencing Fox](https://www.fencingfox.com/),
  [SmartApp](https://fencingfox.com/en/smartApp.html), and [manual](https://fencingfox.com/application/Manual.pdf).
- **Ophardt ecosystem** — Ophardt Touch, Ophardt Online, FencingWorldwide, WheelchairFencing.live, video-refereeing,
  streaming, display, and local/server tools. Production and proprietary. Source:
  [Ophardt software](https://www.ophardt-team.org/en/our-software/).
- **AskFRED ecosystem** — event registration, clubs, teams, schedules, results, mobile access, referee hiring, and an
  API. Production and proprietary/source-unknown. Sources: [AskFRED](https://www.askfred.net/),
  [AskFRED Mobile](https://apps.apple.com/us/app/askfred-mobile/id6760971644),
  [beta API](https://www.askfred.net/developers), [Fencing Referee](https://fencingreferee.com/),
  [Fencing.net](https://fencing.net/), and [14meters](https://14meters.com/).
- **FIE digital services** — international calendar, entries, results, rankings, federation data, and FencingTV.
  Production. Sources: [FIE](https://fie.org/) and [FencingTV](https://www.fencingtv.com/).
- **USA Fencing Tournament Management Platform** — federation registration and event administration. Production.
  Source: [official support documentation](https://usafencing.zendesk.com/hc/en-us/sections/29067354853005-Tournament-Management-Platform).
- **BellePoule** — desktop tournament-management software. Production/historical and GPL. Sources:
  [project site](https://betton.escrime.free.fr/fencing-tournament-software/en/bellepoule/index.html) and
  [GitHub mirror](https://github.com/Oryon/bellepoule).
- **Virtual Scoring Machine Tournament Version** — Windows scoring-machine and tournament integration. Production and
  proprietary. Sources: [product site](https://www.virtualscoringmachine.com/) and
  [tournament manual](https://www.virtualscoringmachine.com/Files/VSMTV_Manual_Revision_D2.pdf).

### FIE competition-software snapshot

The FIE's [December 2023 approved competition-software list](https://static.fie.org/uploads/32/163088-LISTE%20DES%20LOGICIEL%20FIE%20ver202301%20Dec.pdf)
is retained as a historical certification snapshot, not proof of current approval.

| Product | State recorded by the FIE snapshot |
| --- | --- |
| Engarde 10.26.1 | Listed |
| Fence! | No longer in use |
| Fencing Fox 1282 | Listed |
| Fencing Time 4.5.d | Listed |
| Kabcom competition software | No longer in use |
| Mask | No longer in use |
| Ophardt Touch 202.10.3 | Listed |
| Point | Temporarily suspended from 2021-04-01 |

### Additional tournament products and apps

- **Fencing Champion** — web pools, direct elimination, live results, lesson scheduling, and performance analysis.
  Production/source-unknown. [Website](https://fencingchampion.com/).
- **Avedii** — cloud tournament platform. Beta/waitlist and proprietary. [Website](https://avedii.com/).
- **Fencer** — mobile-first tournament and community application. Beta/production transition and proprietary.
  [Website](https://fencer.app/) and [iOS](https://apps.apple.com/us/app/fencer/id6670486948).
- **Flèche** — lightweight single-day individual tournament organizer. Early production/source-unknown.
  [Web app](https://fleche.app/).
- **s-portall** — installable, offline-capable PWA for small pools and direct-elimination events. Early
  production/source-unknown. [Web app](https://s-portall.com/).
- **DUEL** — PWA bout timer and score manager with planned hardware integration. Early-stage/source-unknown.
  [Web app](http://www.duelfencing.pt/).
- **DTFence** — tournament and direct-elimination manager for iPad and Mac. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/dtfence/id6759992502).
- **Fencing Tournament** — iOS competition manager. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/fencing-tournament/id6768607682).
- **Fencing Sports Tournament** — Android tournament manager. Store-listed/status uncertain and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.visunia.fencing.sports).
- **约剑** — Chinese-language registration, draw, results, and community app. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/%E7%BA%A6%E5%89%91/id6740115531).
- **Pools and Pools Lite** — mobile pool management. Production and proprietary.
  [Pools](https://apps.apple.com/us/app/pools/id6784803573) and
  [Pools Lite](https://apps.apple.com/us/app/pools-lite/id6784803851).
- **Aramis Fencing Score Sheet** — mobile score-sheet and pool manager. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/aramis-fencing-score-sheet/id6764003932).
- **Fencing Manager** — mobile tournament/event utility. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/fencing-manager/id6760303574).
- **Fencing League** — league and competition manager. Store-listed/status uncertain and proprietary.
  [App Store](https://apps.apple.com/gb/app/fencing-league/id1492247894).
- **Fencor** — fencing-event application. Historical/store-listed and proprietary.
  [App Store](https://apps.apple.com/us/app/fencor/id1249474877).
- **Scoreboarder** — browser scoreboard and event display. Status uncertain/source-unknown.
  [Website](https://scoreboarder.net/).
- **ClubKnight** — historical British competition-management software. Historical/proprietary. Source:
  [British Fencing's April 2015 Sword magazine](https://britishfencing.com/uploads/files/the_sword_magazine_-_apr_2015_issue_print.pdf).
- **Fencing Link** — historical accreditation, weapon-control, and event operations system. Historical/proprietary.
  Evidence: [archived event documentation](https://fencing.cdn.ophardt.online/documents/invitation/2376-2021.pdf).

### Tournament repositories

- [AtlasCompetitionManager](https://github.com/pietwauters/AtlasCompetitionManager) — tournament manager; OSS,
  GPL-3.0.
- [FenceFlow](https://github.com/nourdesoukizz/fenceflow) — tournament prototype; source-available under PolyForm
  Noncommercial.
- [Enguardia](https://github.com/diegopamio/enguardia) — tournament project; public/no license observed.
- [Fencing_scores](https://github.com/leodp/Fencing_scores) — Android scoring and tournament project; OSS, GPL-3.0.
- [bellepoule-modern](https://github.com/klinnex/bellepoule-modern) — modern BellePoule-related project; public/no
  license observed.
- [fsc-tableau](https://github.com/marvin-steinke/fsc-tableau) — tableau tool; OSS, MIT.
- [piste-planner](https://github.com/noahlz/piste-planner) — piste planning; OSS, MIT.
- [med-escrime](https://github.com/dcoldefy/med-escrime) — fencing event project; public/no license observed.
- [TrainFencing](https://github.com/zTOJU/TrainFencing) — fencing tournament/training project; public/no license
  observed.
- [juge-escrime](https://github.com/darrasse/juge-escrime) — referee/event project; OSS, MIT.
- [Fencing_tournament_app](https://github.com/shaiyjan/Fencing_tournament_app) — tournament application; public/no
  license observed.
- [CompetitionOrganizer](https://github.com/szdav1/CompetitionOrganizer) — competition organizer; public/no license
  observed.
- [allez](https://github.com/saty9/allez) — tournament application; public/no license observed despite its description.
- [FencingTournamentTool](https://github.com/rkblake/FencingTournamentTool) — tournament tool; OSS, MIT.
- [fencing-pool-sheet-typescript](https://github.com/james-demiraiakian/fencing-pool-sheet-typescript) — pool-sheet
  project; public/no license observed.
- [maestro](https://github.com/AlteredConstants/maestro) — historical competition software; public source.
- [qFES](https://github.com/LeStahL/qFES) — competition software; OSS, GPL-3.0.
- [FencingTournamentProgram](https://github.com/Reevak05/FencingTournamentProgram) — historical tournament project;
  public source.
- [Fencein](https://github.com/whgoller/Fencein) — archived tournament project; OSS, GPL-3.0.
- [USA Fencing StripCall](https://github.com/USA-Fencing/StripCall) — historical official strip-calling project.
- [Nova Fencing StripCall](https://github.com/novafencingtech/stripcall) — strip-calling project.
- [project_f](https://github.com/CardboardMechanic/project_f) — competition project.
- [durandal](https://github.com/tapegram/durandal) — competition/event project.
- [fencingcalendar](https://github.com/acandael/fencingcalendar) — calendar tool; OSS, MIT.
- [PoolPopulator](https://github.com/RobertKraaijeveld/PoolPopulator) — pool creation; OSS, MIT.
- [FencingPools](https://github.com/benkoppe/FencingPools) — pool utility.
- [AskFred WebOS Reader](https://github.com/mrfett/AskFred-WebOS-Reader) — historical AskFRED mobile client.
- [ScoreKeeper](https://github.com/mrfett/ScoreKeeper) — historical scorekeeping project.
- [the_lists](https://github.com/alajoie/the_lists) — competition-list utility.

## Refereeing, pool sheets, bout timers, and strip utilities

- **AskFRED Fencing Referee** — cross-platform scorekeeping and referee workflow. Production and proprietary.
  [Website](https://fencingreferee.com/), [iOS](https://apps.apple.com/us/app/fencing-referee/id6747044350), and
  [Android](https://play.google.com/store/apps/details?id=com.askfred.fencingscorekeeper).
- **Fencing score and time** — Android timer, score, cards, and priority. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.zatselyapin.fencing).
- **Fencing Scoring** — Android referee scorekeeper. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.Fencing.fencingscoring).
- **FencingScore Scoreboard** — Android scoreboard. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.cooltime.fencing_score).
- **Fencing Scoreboard** — mobile scoreboard. Production and proprietary.
  [iOS](https://apps.apple.com/us/app/fencing-scoreboard/id1622024469) and
  [Android](https://play.google.com/store/apps/details?id=com.naoyaono.fencing_scoreboard).
- **PretAllez** — Android bout scorekeeper and timer. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.pythia.allez).
- **Second Intention** — mobile referee/scorekeeping tool. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.sn5.secondintention).
- **Fencing Score Counter** — Android score counter. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.fencing.score.counter.visunia).
- **Fencing Scorer with Video** — scorekeeper with synchronized video. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.unanimousworks.fencing_scoring_machine).
- **Fence! Pro** — iOS scorekeeper with Fencing Time Live QR and Bluetooth remote integration. Production and
  proprietary. [App Store](https://apps.apple.com/us/app/fence-pro/id1457412145).
- **Fence!** — earlier basic scorekeeper. Historical/store-listed and proprietary.
  [App Store](https://apps.apple.com/us/app/fence/id1135630817).
- **FencingRef** — long-running iOS referee app. Historical/store-listed and proprietary.
  [App Store](https://apps.apple.com/us/app/fencingref/id322732891).
- **Fencing Score** — iOS scorekeeper. Historical/store-listed and proprietary.
  [App Store](https://apps.apple.com/us/app/fencing-score/id566416368).
- **Fencing Sports Score Counter** — older iOS scorekeeper. Historical/store-listed and proprietary.
  [App Store](https://apps.apple.com/us/app/fencing-sports-score-counter/id1460535084).
- **Touché Point** — mobile bout scoring. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/touch%C3%A9-point/id6780259768).
- **Fencing Score Referee Log 2026** — referee score and log utility. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/fencing-score-referee-log2026/id6776438318).
- **Fundakcja Referee** — referee application. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/fundakcja-referee/id6771507342).
- **Fencing Buzz** — Apple Watch/iPhone scoring appliance paired with a custom Bluetooth module. Production and
  proprietary. [App Store](https://apps.apple.com/us/app/fencing-buzz/id6737521954).
- **FencingPool** — pool-order and Fencing Time Live helper. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/fencingpool/id6475802024).
- **Fencing Helper** — native Fencing Time Live helper. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/fencing-helper/id6740111754).
- **Stab Hub** — Android Fencing Time Live tracker. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.stabhub.android).
- **FindMyFencer** — referee/fencer paging and strip-location helper. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/findmyfencer/id6767763274).
- **Touch by Touch** — US high-school administration and scoring. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/touch-by-touch/id1530755543).
- **Touch by Touch College Fencing** — collegiate administration and scoring. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/touch-by-touch-college-fencing/id6451499719).
- **Fencing Scorekeeper** — open scorekeeping project. Public source.
  [GitHub](https://github.com/gerhardreineke/Fencing).
- **En-Garde** — archived Android scorekeeper. Historical and OSS, GPL.
  [GitHub](https://github.com/ethanmad/En-Garde).
- **Riposte** — formerly popular Android referee app. Historical/discontinued; no stable first-party distribution
  remains.
- **Poule Referee** — community beta pool-refereeing application. Beta distribution/status uncertain.

## Scoring machines, firmware, wireless systems, remotes, and protocols

### Commercial hardware software

- **Calibur** — wireless scoring-system app. Production and proprietary. Sources:
  [documentation](https://calibur.ai/getting-started/), [iOS](https://apps.apple.com/us/app/calibur/id1565327007), and
  [Android](https://play.google.com/store/apps/details?id=com.caliburrn).
- **Calibur Remote Controller** — wireless scoring remote. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/calibur-remote-controller/id1637469178).
- **Calibur Legacy Sabre Mode** — compatibility app for earlier sabre behavior. Historical/store-listed and
  proprietary. [App Store](https://apps.apple.com/us/app/calibur-legacy-sabre-mode/id1535449615).
- **Sigurd Fencing** — wireless scoring system and mobile controller. Production and proprietary.
  [Website](https://www.sigurdfencing.com/?lang=en), [iOS](https://apps.apple.com/us/app/sigurd-fencing/id6751583156),
  and [Android](https://play.google.com/store/apps/details?id=com.infiwalker.fencing).
- **Skewered** — wireless scoring box, app, and public communication protocol. Production with mixed proprietary and
  public-source components. [Scoring box](https://skewered-fencing.com/scoring-box),
  [Android](https://play.google.com/store/apps/details?id=com.skewered_fencing.app),
  [protocol](https://github.com/skewered-fencing/protocol), and
  [development repository](https://github.com/skewered-fencing/development).
- **Favero FA-15 app** — Android control, TV display, diagnostics, and firmware update. Production and proprietary.
  [Product page](https://www.favero.com/en2_fencing_sport_fencing_apparatus_fa_15-319-17.html).
- **Favero FA-07 firmware utilities** — firmware downloads and maintenance. Production and proprietary.
  [Product page](https://favero.com/en2_fencing_sport_fencing_apparatus_fa_07-166-17.html).
- **EnPointe** — wireless fencing system with firmware and desktop updater. Production and proprietary.
  [Website](https://enpointefencing.com/) and [support](https://enpointefencing.com/support/).
- **Virtual Scoring Machine** — Windows scoring machine, Wi-Fi remote, tournament version, and Android replay.
  Production and proprietary. [Website](https://www.virtualscoringmachine.com/) and
  [app index](https://www.virtualscoringmachine.com/Apps.html).
- **Schermatica** — macOS scoring machine and remote-control ecosystem. Community release/status uncertain.

### OpenPiste ecosystem

[OpenPiste](https://openpiste.org/) spans scoring firmware, hardware, testers, mobile remotes, bridge software,
protocols, and displays.

- [esp32scoringdeviceMqtt](https://github.com/pietwauters/esp32scoringdeviceMqtt) — current scoring firmware; OSS,
  GPL-3.0.
- [esp32-scoring-device](https://github.com/pietwauters/esp32-scoring-device) — predecessor firmware; historical and
  OSS, GPL-3.0.
- [remotecontrolapp](https://github.com/pietwauters/remotecontrolapp) — phone remote; public/no license observed.
- [CYDRemoteControl](https://github.com/pietwauters/CYDRemoteControl) — ESP32 CYD remote; public/no license observed.
- [openpiste-bridge](https://github.com/pietwauters/openpiste-bridge) — scoring-device bridge; public/no license
  observed.
- [CyranoPisteMonitor](https://github.com/pietwauters/CyranoPisteMonitor) — piste monitor; public/no license observed.
- [OpenPiste protocols](https://github.com/OpenPiste/protocols) — protocol definitions; OSS, MIT.
- [OPP2 library](https://github.com/OpenPiste/opp2-library) — protocol library; OSS, MIT.
- [ImprovedTesterAfterGenova](https://github.com/pietwauters/ImprovedTesterAfterGenova) — armory tester; OSS, GPL-3.0.
- [WeaponWireTester](https://github.com/pietwauters/WeaponWireTester) — wire tester; OSS, Apache-2.0.

### Additional scoring and wireless projects

The [GitHub scoring catalog](specifications/prior-art/fencing-scoring-github-catalog.md) records a larger, commit-pinned apparatus set and should
be used for implementation-level comparison. Named ecosystem entries include:

- [Touché](https://github.com/Yohannfra/Touche) — wireless system; OSS, GPL-3.0.
- [OpenFencing Wireless](https://github.com/OpenFencing/Wireless) — wireless research; historical and OSS, GPL-3.0.
- [wnew fencing scoring box](https://github.com/wnew/fencing_scoring_box) — all-weapon box; OSS, GPL-3.0.
- [FOSS Box](https://github.com/jamesw98/foss-box) — scoring-box hardware/software; OSS, GPL-3.0.
- [Copis](https://github.com/TheGrimReaper13/Copis) — sabre scoring machine; OSS, MIT.
- [Bluetooth Fencing Scoring System](https://github.com/MatthewKazan/Bluetooth-Fencing-Scoring-System) — wireless
  prototype; public source.
- [Fencing Box Brain](https://github.com/swordsgnat/Fencing_Box_Brain) — scoring firmware; OSS, GPL.
- [emcannaert Fencing Scoring Machine](https://github.com/emcannaert/Fencing-Scoring-Machine) — scoring apparatus;
  OSS, GPL-3.0.
- [Arduino Fencing Scoring Machine](https://github.com/XiangyiTan/Arduino-Fencing-Scoring-Machine) — epee-themed
  scorer/scoreboard prototype; public source.
- [cy6erskunk scoring machine](https://github.com/cy6erskunk/fencing-scoring-machine) — scoring-machine project; OSS,
  MIT.
- [JBox](https://sourceforge.net/projects/fencingbox/) — historical scoring firmware and hardware; OSS.
- [OpenBox](https://github.com/bhuvan21/OpenBox) — unfinished scoring system; public source.
- [foilBox](https://github.com/digitalWestie/foilBox) — foil project; public source.
- [mrfett scoring_machine](https://github.com/mrfett/scoring_machine) — historical scoring project; public source.
- [EnGarde Fencing Scoring System](https://github.com/thomasrwolfgang/EnGarde-Fencing-Scoring-System) — DIY apparatus;
  public source.
- [wireless_fencing_box](https://github.com/punkyman/wireless_fencing_box) — wireless experiment; OSS, GPL-3.0.
- [Allez](https://github.com/PaulMichell/Allez) — scoring-system placeholder; OSS, GPL-2.0.
- [ArduinoFencingBox](https://github.com/Shlepzig/ArduinoFencingBox) — Arduino scorer; public source.
- [ArduinoWiFiFencingScoringDetection](https://github.com/Vilda007/ArduinoWiFiFencingScoringDetection) and
  [second version](https://github.com/Vilda007/ArduinoWiFiFencingScoringDetection2) — Wi-Fi scoring experiments;
  public/GPL source.
- [joejensen fencingbox](https://github.com/joejensen/fencingbox) — JBox apparatus; OSS, GPL-3.0.

### Protocols, displays, repeaters, and test equipment

- **Cyrano libraries** — [Swift tools](https://github.com/seigel/cyrano) and
  [Nicolas Drapier's implementation](https://github.com/NicolasDrapier/cyrano); OSS, MIT.
- [Favero Repeater](https://github.com/vehemont/Favero_Repeater) — scoring-output repeater; OSS, GPL.
- [Favero Overlay](https://github.com/BenKohn2004/Favero_Overlay) — scoring overlay; OSS, GPL.
- [Favero master emulator](https://github.com/Gioee/fav3er0-master-emulator) — protocol/device emulator; public/no
  license observed.
- [Mask Lights](https://github.com/BenKohn2004/Mask_Lights) — mask/external-light integration; OSS, GPL.
- [SG12 Scoring Extension Lights](https://github.com/UAHFencingClub/SG12_ScoringExtensionLights) — scoring-light
  extension; public source.
- [Fencing Light OBS Overlay](https://github.com/BenKohn2004/Fencing_Light_OBS_Overlay) — broadcast overlay; public
  source.
- [Fencing Testbox for Flipper Zero](https://github.com/aarjaneiro/fencing_testbox) — apparatus testbox; OSS, MIT.
- [BladeOMatic](https://github.com/DeanK2022/BladeOMatic) — blade/weapon tester; public source.
- [Fencing Timing Tester](https://github.com/AjaxTheLesser/FencingTimingTester) — timing validation; OSS, GPL-3.0.
- [Armory Dashboard](https://github.com/antsar/armory-dashboard) — armory workflow app; OSS, MIT.

## Video refereeing, replay, streaming, and video analysis

### FIE video-refereeing snapshot

The FIE's [December 2023 approved video-system list](https://static.fie.org/uploads/32/163082-LISTE%20DES%20VIDEOARBITRAGE%20FIE%20ver202301%20Dec.pdf)
records the following historical certification state:

| Product | State recorded by the FIE snapshot |
| --- | --- |
| Atlas | No longer updated |
| Skouting ST37 1.2 | Listed |
| Beijing Jiahere | No reply recorded |
| Fencing Replay 1.4.0.1 | Listed |
| Fencing Vision / fencing-video.com | No reply recorded |
| Kabcom 0723-K77 | Listed |
| KOOV Broadcasting 3.0.2.9 | Listed |
| Lammet OKO-F | No reply recorded |
| Swiss Timing Sport Service Floox 2.9.1 | Listed |

### Additional video tools

- **Super Fencing System** — iOS replay and scoring integration supporting several scoring protocols. Production and
  proprietary. [App Store](https://apps.apple.com/us/app/super-fencing-system/id6449682618).
- **ReBout** — delayed replay for fencing and HEMA. Production and proprietary/source-unknown.
  [Website](https://rebout.tsc.sk/) and [iOS](https://apps.apple.com/us/app/rebout-fencing-hema-replay/id6748567110).
- **UAH Video Replay System** — fencing replay implementation. OSS, GPL.
  [GitHub](https://github.com/UAHFencingClub/VideoReplaySystem).
- **video-remise** — fencing replay project. OSS, MIT. [GitHub](https://github.com/alan-geller/video-remise).
- **FA5 Replayer** — Favero-oriented replay tool. Public source. [GitHub](https://github.com/tzerc/fa5-replayer).
- **videoreferee** — video-refereeing project. Public source. [GitHub](https://github.com/zegkljan/videoreferee).
- **Fencing Camera** — mobile fencing recording/replay. Production and proprietary.
  [App Store](https://apps.apple.com/us/app/fencing-camera/id6775329132).
- **FencingVault** — bout recording and video library. Production and proprietary.
  [iOS](https://apps.apple.com/us/app/fencingvault/id6771156769) and
  [Android](https://play.google.com/store/apps/details?id=app.fencingvault.android).
- **Fencing Video Replay** — historical Android replay utility. Historical/status uncertain.
- **Delay Camera** — generic delayed video explicitly used for fencing practice. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=com.kohshin.delaycamera).
- **Video Delay Instant Replay CAM** — generic replay tool used by fencing clubs. Production and proprietary.
  [Google Play](https://play.google.com/store/apps/details?id=borama.co.mirrorcoach).

## Coaching, training, analysis, and athlete development

### Web and commercial products

- [Fencer IQ](https://www.fenceriq.ai/) — AI bout analysis and club tools; production/proprietary.
- [FencingInsights.ai](https://www.fencinginsights.ai/) — video and performance analysis;
  production/proprietary.
- [Fencing AI](https://www.fencing-ai.com/) — AI analysis platform; production/proprietary.
- [Fencers Page coaching](https://fencingai.com/coaches) — coaching and fencer profiles; production/proprietary.
- [Vertexo Fencing](https://www.vertexo.ai/sports/fencing/) — AI sports-video analysis vertical;
  production/proprietary.
- [BoutCoach](https://boutcoach.com/) — digital coach and bout analysis; production/proprietary.
- [Piste IQ](https://pisteiqapp.com/) and [iOS app](https://apps.apple.com/us/app/piste-iq/id6763344726) — tactical and
  performance app; production/proprietary.
- [SmarterFencing](https://smarterfencing.ai/) — AI-assisted coaching and analysis; production/proprietary.
- [FenceX](https://fence-x.org/pages/faq) — electronic training and analysis product; production/proprietary.
- [Athlete Analyzer for Fencing](https://www.athleteanalyzer.com/training-planner-fencing) — plans, athlete monitoring,
  and video; production/proprietary.
- [Fencing Buddies](https://fencingbuddies.com/features) — training plans, tracking, and community;
  production/proprietary.
- [FencStats](https://fencstats.com/) — athlete and result statistics; production/source-unknown.
- [Fencing Tracker](https://fencingtracker.com/) — competition records and results tracking;
  production/source-unknown.
- [Carlotta Coach](https://carlottacoach.com/fencing-coach-2/) — fencing coaching platform;
  production/proprietary.
- [Footwork](http://www.fencing-footwork.com/) — browser footwork trainer; status uncertain/source-unknown.

### Mobile training and analysis

- [FencingX](https://apps.apple.com/us/app/fencingx/id6755701720) — AI training and analysis.
- [Launchpad Fencing](https://apps.apple.com/us/app/launchpad-fencing/id6752629485) — training app.
- [FencingLab](https://apps.apple.com/us/app/fencinglab/id6758785773) — training and analysis.
- [FencingVision](https://apps.apple.com/us/app/fencingvision/id6535649230) — earlier video-analysis app.
- [FencingVision AI Coach](https://apps.apple.com/us/app/fencingvision-ai-coach/id6794765462) — AI coach.
- [AI FencingMeter](https://apps.apple.com/us/app/ai-fencingmeter/id6767151888) — AI measurement/analysis.
- [Slavatron](https://apps.apple.com/us/app/slavatron/id6742027610) — training tool.
- [Touche Fencing](https://apps.apple.com/us/app/touche-fencing/id6766762231) — training and logging.
- [Escrime: Fence, Compete, Track](https://apps.apple.com/us/app/escrime-fence-compete-track/id6762008090) — athlete
  and competition tracker.
- [FencingDynamics](https://apps.apple.com/us/app/fencingdynamics/id6744992083) — training and movement.
- [FencingAnalyzer](https://apps.apple.com/de/app/fencinganalyzer/id6744269793) — performance analysis.
- [NoteBlade](https://apps.apple.com/us/app/noteblade/id6462387243) — notes and bout journal.
- [Fence Sense](https://apps.apple.com/us/app/fence-sense/id6789785867) — tactical/training app.
- [OnStrip](https://apps.apple.com/us/app/onstrip/id6752228539) — training and competition companion.
- [MyFencer](https://www.csxdevelopers.co.uk/pages/app-myfencer.html) — athlete and parent development app.
- [i Fencing](https://apps.apple.com/hk/app/i-fencing/id1529842873) — reference, notes, and fencing log.
- [Fencing Tutorial](https://apps.apple.com/gb/app/fencing-tutorial/id6443629138) — instructional app.
- [FencingPro](https://apps.apple.com/us/app/fencingpro/id1437862393) — instructional/training app.
- [SimpleSaber](https://apps.apple.com/us/app/simplesaber/id6464338343) — sabre training.
- [Tyshler FootDisco](https://apps.apple.com/gb/app/tyshler-footdisco/id1594102841) — footwork training.
- [MyCoach by FFEscrime](https://apps.apple.com/fr/app/mycoach-by-ffescrime/id1582173521) — French federation coaching
  and club app.
- [Bida Foundation](https://bidafoundation.online) and
  [Android](https://play.google.com/store/apps/details?id=com.appfyl.bida.android) — training and education.
- [Fencing Flow](https://apps.apple.com/tw/app/fencing-flow/id6759300025) — training app.
- [LungeFlow](https://apps.apple.com/us/app/lungeflow/id6738582807) — lunge and movement analysis.
- [Fencing TV Stats](https://apps.apple.com/us/app/fencing-tv/id6794883720) — broadcast/bout-statistics companion.
- [Fencing One](https://apps.apple.com/us/app/fencing-one/id6443978936) — older general fencing app.
- **FIE Rules App** — discontinued official rules app. Historical. Sources:
  [British Fencing withdrawal notice](https://www.britishfencing.com/policy-zone/rules-zone/fie-rules-app/) and the
  current [FIE rules index](https://fie.org/documents/rules).

### Open-source and research analysis projects

- [Know Your Parries](https://github.com/AntonVanAssche/kyp.tk) — tactical learning web app; public source.
- [fencing-drill](https://github.com/nimamura/fencing-drill) — drill generator; OSS, MIT.
- [fencing-AI by GalDude33](https://github.com/GalDude33/fencing-AI) — computer-vision project.
- [fencing-AI by Sholto Douglas](https://github.com/sholtodouglas/fencing-AI) — computer-vision analysis.
- [RT-Fencing](https://github.com/CodLiver/RT-Fencing) — real-time analysis/refereeing research.
- [Fencing-Ref](https://github.com/BANANAPEEL202/Fencing-Ref) — automated referee research.
- [fencing-ai-ref](https://github.com/albTian/fencing-ai-ref) — AI referee prototype.
- [fencing-vision](https://github.com/Ph1n-Pham/fencing-vision) — computer-vision project.
- [FencingMaestro](https://github.com/cinastanbean/FencingMaestro) — coaching/analysis prototype.
- [saber-referee](https://github.com/LeJamon/saber-referee) — sabre referee research.
- [Freffy](https://github.com/PLIAN78/Freffy) — analysis/referee project.
- [En-Garde AI Foil Coach](https://github.com/studroid/En-Garde-AI---Foil-Coach) — AI foil-coaching prototype.
- [FERA](https://arxiv.org/abs/2509.18527) — research system.
- [FenceNet](https://arxiv.org/abs/2204.09434) — research system.
- [VirtualFencer](https://arxiv.org/abs/2507.00261) — research system.
- [LungeFlow paper](https://aircconline.com/csit/papers/vol15/csit150404.pdf) — research system.
- [Tactical visualization paper](https://arxiv.org/abs/2011.01446) — research system.

Research entries are retained as part of the corpus but must not be presented as deployed community products without
separate evidence.

## Club, lesson, membership, federation, and event operations

- [FencR](https://www.fencr.app/) — fencing-specific club administration; production/proprietary.
- [ParryUp](https://apps.apple.com/us/app/parryup-fencing-club-manager/id6503641652) — fencing club management;
  production/proprietary.
- [Paak](https://paak.club/en/fencing-software/) — members, lessons, payments, and club management;
  production/proprietary.
- [Fencing Office](https://fencingoffice.com/) — fencing club administration; production/proprietary.
- [ScheduleFencing](https://schedulefencing.com/) — lessons, instructors, schedules, and bookings;
  production/proprietary.
- [Fencers Page club management](https://fencingai.com/tournament-management) — club and tournament operations;
  production/proprietary.
- [Fencer IQ for clubs](https://www.fenceriq.ai/for-clubs) — club athlete/video features;
  production/proprietary.
- [SportEasy Fencing](https://www.sporteasy.net/en/clubs/sports/fencing/) — generic team platform with a fencing
  vertical; production/proprietary.
- [Playpass Fencing Management](https://playpass.com/sports-software/fencing-management) — generic sports software
  configured for fencing; production/proprietary.
- [PisteHub](https://apps.apple.com/kr/app/%ED%94%BC%EC%8A%A4%ED%8A%B8%ED%97%88%EB%B8%8C-%ED%8E%9C%EC%8B%B1-%ED%81%B4%EB%9F%BD-%ED%9A%8C%EC%9B%90%EC%95%B1/id6789796003)
  — Korean club member app; production/proprietary.
- [Clawer](https://apps.apple.com/us/app/clawer/id6744362919) — club/community app; production/proprietary.
- [Fencing Plus](https://apps.apple.com/gb/app/fencing-plus%E5%B0%8F%E5%8A%8D%E7%A5%9E%E5%9F%B9%E8%A8%88%E5%8A%83/id6762038603)
  — club and training administration; production/proprietary.
- **Smart Salle** — historical fencing-specific club-management product; current distribution uncertain.

Club-branded apps are also part of the corpus:

- [United Fencing Academy](https://apps.apple.com/ca/app/united-fencing-academy/id6798921867)
- [Club de Esgrima EL DUQUE](https://apps.apple.com/es/app/club-de-esgrima-el-duque/id6460218998)
- [Esgrima Pozuelo](https://apps.apple.com/es/app/esgrima-pozuelo/id6751635473)
- [HK Elite Fencing](https://apps.apple.com/us/app/hk-elite-fencing/id6450834899)
- [Co-Fencing Space](https://apps.apple.com/gb/app/co-fencing-space/id6680190834)
- [i-Fencing Alliance Club](https://apps.apple.com/gb/app/i-fencing-alliance-club/id1660693408)
- [Fencing Laboratory](https://apps.apple.com/us/app/fencing-laboratory/id6447956579)
- [Kaizen Fencing](https://apps.apple.com/us/app/kaizen-fencing/id6751193894)

Generic products repeatedly adapted by fencing clubs are a separate adjacent set rather than purpose-built fencing
software: Mindbody, Zen Planner, Acuity Scheduling, Spark Membership, TeamSnap, ClassForKids, GymDesk, SportEasy,
Playwaze, and Playpass.

## Statistics, datasets, rankings, federation apps, and archives

- [FenceDB](https://fencedb.sourceforge.net/) and [SourceForge project](https://sourceforge.net/projects/fencedb/) —
  historical fencing database.
- [Fencing Database](https://www.fencingdatabase.com/) — searchable bout/video database.
- [Felo](https://felo.sourceforge.net/felo/index.html) — historical Elo-style fencing ratings.
- [ISFL Fencing](https://isflfencing.com/) — scholastic operations/results platform and BoutShout successor.
- [Fencing India](https://apps.apple.com/us/app/fencing-india/id6773065627) — federation/event app.
- [UzFencing](https://apps.apple.com/us/app/uzfencing/id6775852749) — federation app.
- [Jordan Fencing](https://apps.apple.com/us/app/jordan-fencing/id6760185663) — federation app.
- [Korean Fencing Federation](https://apps.apple.com/us/app/%EB%8C%80%ED%95%9C%ED%8E%9C%EC%8B%B1%ED%98%91%ED%9A%8C/id6742041780)
  — federation app.
- [击剑圈](https://apps.apple.com/us/app/%E5%87%BB%E5%89%91%E5%9C%88/id6472758619) — Chinese fencing community
  and results app.
- [Kuwait 2024](https://apps.apple.com/us/app/kuwait-2024/id6503451004) — event-specific app.
- [Napoli 2024](https://apps.apple.com/us/app/napoli-2024/id6477866197) — event-specific app.

Open data and statistics projects include:

- [touchestats](https://github.com/rivkalipko/touchestats)
- [PAPERS rating system](https://github.com/seanyoon777/PAPERS)
- [FencingResultsAggregate](https://github.com/Fencerman2/FencingResultsAggregate)
- [FIE web scraper](https://github.com/Carpfire/FIE_webscrapper)
- [fencing_data_tools](https://github.com/Daniel-Ko/fencing_data_tools)
- [FIE fencing dataset](https://github.com/amichaelsen/fie-fencing-dataset)
- [therobotreader fencing-database](https://github.com/therobotreader/fencing-database)
- [FEB23 fencingstats](https://github.com/FEB23/fencingstats)
- [ausfencer](https://github.com/RattlePenguin/ausfencer)

## Maintenance fields

The durable form of this corpus should retain the following fields for each canonical entry:

```text
canonical_name
aliases
primary_category
secondary_categories
platforms
countries_or_regions
website
store_urls
repository_urls
owner_or_vendor
source_model
license
current_status
first_seen
last_verified
fie_or_federation_approval
scoring_hardware_compatibility
protocol_support
competition_import_export_formats
evidence_urls
notes
successor_or_predecessor
```

`current_status`, `source_model`, and `community_adoption` must remain independent. A dormant GPL repository, a
discontinued commercial application, and a beta product are distinct states, but all remain in the corpus.

## Refresh procedure

1. Preserve entries when a product disappears. Change its status and record the last verified evidence instead of
   deleting it.
2. Treat app-store availability as territory-specific. Record the storefront and inspection date.
3. Record a public repository as OSS only after identifying its license. Otherwise use `Public/no license`.
4. Pin repository evidence to an inspected commit in the specialized GitHub catalog. Product homepages may remain live
   links here.
5. Keep FIE approval and current product status separate. A historical FIE list is not current homologation evidence.
6. Add aliases and predecessor/successor relationships rather than creating duplicate records after a rename.
7. Keep generic scheduling, streaming, and video tools in the adjacent-use set unless they publish or implement a
   fencing-specific integration.
