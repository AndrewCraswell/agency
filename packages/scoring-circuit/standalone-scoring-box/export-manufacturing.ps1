param(
    [string]$KiCadCli = 'C:/Program Files/KiCad/10.0/bin/kicad-cli.exe',
    [string]$OutputDirectory = "$PSScriptRoot/output/manufacturing-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
)
$ErrorActionPreference = 'Stop'
$exportDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $exportDirectory) { throw 'Use a new directory so obsolete exports cannot enter this package.' }
New-Item -ItemType Directory -Path $exportDirectory | Out-Null
$board = Join-Path $PSScriptRoot 'standalone-scoring-box.kicad_pcb'
$schematic = Join-Path $PSScriptRoot 'standalone-scoring-box.kicad_sch'
function Invoke-KiCad([string[]]$Arguments) {
    & $KiCadCli @Arguments
    if ($LASTEXITCODE -ne 0) { throw "KiCad failed: $($Arguments -join ' ')" }
}
Invoke-KiCad @('sch', 'erc', $schematic, '--format', 'json', '--exit-code-violations', '--output', "$exportDirectory/erc.json")
Invoke-KiCad @('pcb', 'drc', $board, '--format', 'json', '--schematic-parity', '--refill-zones', '--exit-code-violations', '--output', "$exportDirectory/drc.json")
Invoke-KiCad @('sch', 'export', 'bom', $schematic, '--exclude-dnp', '--fields', 'Reference,Value,Footprint,Manufacturer,MPN,LCSC', '--labels', 'Reference,Value,Footprint,Manufacturer,MPN,LCSC', '--output', "$exportDirectory/bom.csv")
Invoke-KiCad @('pcb', 'export', 'pos', $board, '--format', 'csv', '--units', 'mm', '--exclude-dnp', '--use-drill-file-origin', '--output', "$exportDirectory/placement.csv")
$bom = @(Import-Csv -LiteralPath "$exportDirectory/bom.csv")
$placement = @(Import-Csv -LiteralPath "$exportDirectory/placement.csv")
if ($bom.Count -eq 0 -or $placement.Count -eq 0) { throw 'Empty assembly export.' }
if (@($bom | Where-Object { -not $_.Manufacturer -or -not $_.MPN -or -not $_.Footprint }).Count -ne 0) { throw 'Assembly ordering fields are missing.' }
if (@($bom | Group-Object Reference | Where-Object Count -ne 1).Count -ne 0 -or
    @($placement | Group-Object Ref | Where-Object Count -ne 1).Count -ne 0 -or
    @(Compare-Object $bom.Reference $placement.Ref).Count -ne 0) { throw 'BOM and placement references do not match uniquely.' }
# Exact MPNs and reviewed catalog IDs from this board, not auto-matched substitutions.
$bom | ForEach-Object {
    [pscustomobject][ordered]@{
        Comment = $_.MPN
        Designator = $_.Reference
        Footprint = $_.Footprint
        Manufacturer = $_.Manufacturer
        MPN = $_.MPN
        'LCSC Part #' = $_.LCSC
    }
} | Export-Csv -LiteralPath "$exportDirectory/jlcpcb-bom.csv" -NoTypeInformation -Encoding utf8
$placement | ForEach-Object {
    if ($_.Side -notin @('top', 'bottom')) { throw "Unknown placement side for $($_.Ref)." }
    [pscustomobject][ordered]@{
        Designator = $_.Ref
        'Mid X' = $_.PosX
        'Mid Y' = $_.PosY
        Layer = if ($_.Side -eq 'top') { 'Top' } else { 'Bottom' }
        Rotation = $_.Rot
    }
} | Export-Csv -LiteralPath "$exportDirectory/jlcpcb-placement.csv" -NoTypeInformation -Encoding utf8
# Gerbers, drills and placements share the saved auxiliary origin. Include THT placements.
Invoke-KiCad @('pcb', 'export', 'gerbers', $board, '--layers', 'F.Cu,In1.Cu,In2.Cu,B.Cu,F.Mask,B.Mask,F.Paste,B.Paste,F.Silkscreen,B.Silkscreen,Edge.Cuts', '--check-zones', '--subtract-soldermask', '--use-drill-file-origin', '--output', "$exportDirectory/gerbers/")
Invoke-KiCad @('pcb', 'export', 'drill', $board, '--format', 'excellon', '--drill-origin', 'plot', '--excellon-units', 'mm', '--excellon-separate-th', '--generate-report', '--report-path', "$exportDirectory/drill-report.txt", '--output', "$exportDirectory/gerbers/")
Compress-Archive -Path "$exportDirectory/gerbers/*" -DestinationPath "$exportDirectory/pcb-fabrication.zip"
Invoke-KiCad @('pcb', 'export', 'pdf', $board, '--layers', 'F.Fab,Edge.Cuts', '--mode-single', '--black-and-white', '--sketch-pads-on-fab-layers', '--exclude-value', '--output', "$exportDirectory/assembly-top.pdf")
$modelDirectory = [System.IO.Path]::GetFullPath((Join-Path (Split-Path $KiCadCli) '../share/kicad/3dmodels'))
Invoke-KiCad @('pcb', 'render', $board, '--output', "$exportDirectory/board-top-3d.png", '--width', '1800', '--height', '1200', '--background', 'opaque', '--quality', 'high', '--rotate', '330,0,20', '-D', "KICAD10_3DMODEL_DIR=$modelDirectory")
# Refresh the documented local preview from this same board export.
New-Item -ItemType Directory -Path "$PSScriptRoot/output" -Force | Out-Null
Copy-Item -LiteralPath "$exportDirectory/board-top-3d.png" -Destination "$PSScriptRoot/output/board-top-3d.png" -Force
foreach ($handoff in @('README.md', 'power-handoff.md', 'prepare-power-profile.py')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $handoff) -Destination (Join-Path $exportDirectory $handoff)
}
Write-Output "Exported $($bom.Count) purchased parts and matching placements to $exportDirectory. Review draft, not manufacturing approval."
Write-Output 'U5 needs a real NVM readback and verified programming. No factory-qualified binary, STM32/ESP32 application image, upload or order is included.'
