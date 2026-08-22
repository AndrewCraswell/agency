[CmdletBinding()]
param(
  [string]$BuildDirectory,
  [ValidateSet("Debug", "Release")]
  [string]$Configuration = "Debug"
)

$ErrorActionPreference = "Stop"
$sourceDirectory = Join-Path $PSScriptRoot ".."
if ([string]::IsNullOrWhiteSpace($BuildDirectory)) {
  $BuildDirectory = Join-Path $sourceDirectory "out\\host-clang"
}
$wingetPackages = Join-Path $env:LOCALAPPDATA "Microsoft\\WinGet\\Packages"
$ninja = Join-Path $wingetPackages "Ninja-build.Ninja_Microsoft.Winget.Source_8wekyb3d8bbwe\\ninja.exe"
$compiler = Join-Path $wingetPackages "MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\\llvm-mingw-20260616-ucrt-x86_64\\bin\\x86_64-w64-mingw32-clang.exe"

if (-not (Test-Path -LiteralPath $ninja) -or -not (Test-Path -LiteralPath $compiler)) {
  throw "The native host test requires Ninja and an x86_64 MinGW C compiler."
}

cmake -G Ninja -S $sourceDirectory -B $BuildDirectory "-DCMAKE_BUILD_TYPE=$Configuration" "-DCMAKE_MAKE_PROGRAM=$ninja" "-DCMAKE_C_COMPILER=$compiler"
cmake --build $BuildDirectory --config $Configuration
ctest --test-dir $BuildDirectory --build-config $Configuration --output-on-failure
