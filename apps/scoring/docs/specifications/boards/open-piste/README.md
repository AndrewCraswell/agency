# OpenPiste hardware evaluation snapshot

This directory contains a pinned copy of the OpenPiste revision 1.2 PCB sources and manufacturing outputs. It is here so the electrical design, PCB layout, connector assignments, component choices, and fabrication package can be evaluated without depending on a moving upstream branch.

Importing these files does not mean that the design is approved for fabrication, satisfies our product requirements, or has been shown to conform to FIE rules.

## Provenance

- Upstream repository: [pietwauters/esp32_scoring_device_hardware](https://github.com/pietwauters/esp32_scoring_device_hardware)
- Pinned commit: [`4af00be1bed179023d99867c808b650275fd0b26`](https://github.com/pietwauters/esp32_scoring_device_hardware/commit/4af00be1bed179023d99867c808b650275fd0b26)
- Upstream commit date: June 8, 2026
- Retrieved: August 25, 2026
- Integrity record: [SHA256SUMS](SHA256SUMS)

Except for the deliberately omitted upstream licence file, the files under `upstream/` preserve the bytes stored in the pinned Git commit. The upstream `images/` directory was not copied because it contains assembly and enclosure photographs rather than KiCad sources, component models, or manufacturing data.

## Start here

| What to evaluate | File |
| --- | --- |
| KiCad project | [ESP32ScoringDevice_PCB_THT_Rev1.2.kicad_pro](upstream/ESP32ScoringDevice_PCB_THT_Rev1.2.kicad_pro) |
| Schematic | [ESP32ScoringDevice_PCB_THT_Rev1.2.kicad_sch](upstream/ESP32ScoringDevice_PCB_THT_Rev1.2.kicad_sch) |
| PCB layout and board definition | [ESP32ScoringDevice_PCB_THT_Rev1.2.kicad_pcb](upstream/ESP32ScoringDevice_PCB_THT_Rev1.2.kicad_pcb) |
| Bill of materials | [BOM.md](upstream/BOM.md) |
| Gerber and drill outputs | [Gerber_files_for_PCB_production](upstream/Gerber_files_for_PCB_production/) |
| Upstream build walkthrough | [Walkthrough to build OpenPiste Fencing Scoring Machine.docx](<upstream/Walkthrough to buildOpenPiste  Fencing Scoring Machine.docx>) |
| Upstream overview | [README.md](upstream/README.md) |
| Hardware licence | [Upstream GPLv3 licence](https://github.com/pietwauters/esp32_scoring_device_hardware/blob/4af00be1bed179023d99867c808b650275fd0b26/LICENSE) |

Open the `.kicad_pro` file in KiCad to load the project. The project also includes its upstream `fp-info-cache`, `sym-lib-table`, and local project settings.

## 3D model limitation

The upstream repository does not contain a standalone STEP export of the assembled board. The PCB file contains 57 footprint model references. Most resolve through the standard KiCad 3D model libraries, but the ESP32 development-board footprint refers to this external model:

```text
${VL_PACKAGES3D}/esp32_devkit_v1_doit.3dshapes/esp32_devkit_v1_doit.step
```

That custom STEP file is not included in the upstream repository. A complete 3D render or derived board STEP therefore requires installing the matching standard KiCad libraries and locating or replacing the missing ESP32 model. No generated STEP file is included here because it could not be reproduced from the pinned repository alone.

## Licence boundary

The repository supplies the GNU General Public License Version 3 as the licence for these hardware sources. The licence file is not vendored in this snapshot, but removing the local copy does not remove or change the upstream terms. Review the [licence at the pinned commit](https://github.com/pietwauters/esp32_scoring_device_hardware/blob/4af00be1bed179023d99867c808b650275fd0b26/LICENSE) and obtain appropriate legal guidance before modifying, manufacturing, or distributing a design based on these files. Keep this hardware-source licence analysis separate from any firmware or protocol-library licence analysis.
