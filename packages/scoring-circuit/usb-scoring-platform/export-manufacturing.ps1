param(
    [string]$KiCadCli = 'C:/Program Files/KiCad/10.0/bin/kicad-cli.exe',
    [string]$OutputDirectory = "$PSScriptRoot/output/manufacturing-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
)
$ErrorActionPreference = 'Stop'
$exportDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $exportDirectory) { throw 'Use a new output directory so obsolete exports cannot enter the package.' }
New-Item -ItemType Directory -Path $exportDirectory | Out-Null
$board = Join-Path $PSScriptRoot 'usb-scoring-platform.kicad_pcb'
$schematic = Join-Path $PSScriptRoot 'usb-scoring-platform.kicad_sch'
function Invoke-KiCad([string[]]$Arguments) {
    & $KiCadCli @Arguments
    if ($LASTEXITCODE -ne 0) { throw "KiCad failed: $($Arguments -join ' ')" }
}
Invoke-KiCad @('sch', 'erc', $schematic, '--format', 'json', '--exit-code-violations', '--output', "$exportDirectory/erc.json")
Invoke-KiCad @('pcb', 'drc', $board, '--format', 'json', '--schematic-parity', '--refill-zones', '--exit-code-violations', '--output', "$exportDirectory/drc.json")
Invoke-KiCad @('sch', 'export', 'bom', $schematic, '--exclude-dnp', '--fields', 'Reference,Value,Footprint,Manufacturer,MPN', '--labels', 'Reference,Value,Footprint,Manufacturer,MPN', '--output', "$exportDirectory/bom.csv")
Invoke-KiCad @('pcb', 'export', 'pos', $board, '--format', 'csv', '--units', 'mm', '--exclude-dnp', '--output', "$exportDirectory/placement.csv")
$bom = @(Import-Csv -LiteralPath "$exportDirectory/bom.csv")
$placement = @(Import-Csv -LiteralPath "$exportDirectory/placement.csv")
if ($bom.Count -eq 0 -or $placement.Count -eq 0) { throw 'Empty assembly export.' }
if (@($bom | Where-Object { -not $_.Manufacturer -or -not $_.MPN -or -not $_.Footprint }).Count -ne 0) { throw 'Assembly ordering fields are missing.' }
if (@($bom | Group-Object Reference | Where-Object Count -ne 1).Count -ne 0 -or
    @($placement | Group-Object Ref | Where-Object Count -ne 1).Count -ne 0 -or
    @(Compare-Object $bom.Reference $placement.Ref).Count -ne 0) { throw 'BOM and placement references do not match uniquely.' }
# Supplier upload aliases, generated from this same native export. Do not reuse older catalog matches.
# Exact MPN is the procurement comment: legacy Value labels can contain a lower nominal voltage rating.
$bom | ForEach-Object {
    [pscustomobject][ordered]@{
        Comment = $_.MPN
        Designator = $_.Reference
        Footprint = $_.Footprint
        Manufacturer = $_.Manufacturer
        MPN = $_.MPN
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
Invoke-KiCad @('pcb', 'export', 'gerbers', $board, '--layers', 'F.Cu,In1.Cu,In2.Cu,B.Cu,F.Mask,B.Mask,F.Paste,B.Paste,F.Silkscreen,B.Silkscreen,Edge.Cuts', '--check-zones', '--subtract-soldermask', '--output', "$exportDirectory/gerbers/")
Invoke-KiCad @('pcb', 'export', 'drill', $board, '--format', 'excellon', '--excellon-units', 'mm', '--excellon-separate-th', '--generate-report', '--report-path', "$exportDirectory/drill-report.txt", '--output', "$exportDirectory/gerbers/")
Compress-Archive -Path "$exportDirectory/gerbers/*" -DestinationPath "$exportDirectory/pcb-fabrication.zip"
foreach ($handoff in @('README.md', 'design-review.md', 'usb-acquisition-power.md')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $handoff) -Destination (Join-Path $exportDirectory $handoff)
}
# U21 must be programmed before the board can qualify either power mode. Build from current source,
# never copy a possibly stale image from a previous firmware/out directory.
$controllerDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../apps/scoring/firmware/power-control'))
$programmingDirectory = Join-Path $exportDirectory 'programming/U21'
& (Join-Path $controllerDirectory 'build-target.ps1') -OutputDirectory $programmingDirectory
Copy-Item -LiteralPath (Join-Path $controllerDirectory 'README.md') -Destination (Join-Path $programmingDirectory 'README.md')
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $programmingDirectory 'power-control.hex') |
    Format-List Algorithm, Hash, Path | Out-String | Write-Output
Write-Output "Exported $($bom.Count) assembly parts to $exportDirectory. These are review files, not manufacturing approval."
Write-Output 'U21 programming image is included separately from Gerbers. Factory programming and fixture acceptance are still required; no firmware has been flashed.'
