param([string]$OutputDirectory = "$PSScriptRoot/../out/power-control-target")
$ErrorActionPreference = 'Stop'
$targetDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
$elf = Join-Path $targetDirectory 'power-control.elf'
& clang --target=arm-none-eabi -mcpu=cortex-m0plus -mthumb -std=c17 -Oz -g -ffreestanding -fno-builtin -ffunction-sections -fdata-sections -Wall -Wextra -Werror -Wconversion -Wsign-conversion -Wpedantic -nostdlib -fuse-ld=lld "-Wl,-T,$PSScriptRoot/stm32c011.ld" '-Wl,--gc-sections' "-Wl,-Map,$targetDirectory/power-control.map" "$PSScriptRoot/startup.S" "$PSScriptRoot/power_control.c" "$PSScriptRoot/stm32c011_power.c" -o $elf
if ($LASTEXITCODE -ne 0) { throw 'STM32C011 cross-build failed' }
& llvm-objcopy -O ihex $elf (Join-Path $targetDirectory 'power-control.hex')
if ($LASTEXITCODE -ne 0) { throw 'HEX export failed' }
& llvm-objcopy -O binary $elf (Join-Path $targetDirectory 'power-control.bin')
if ($LASTEXITCODE -ne 0) { throw 'BIN export failed' }
& llvm-size $elf
if ($LASTEXITCODE -ne 0) { throw 'Size inspection failed' }
