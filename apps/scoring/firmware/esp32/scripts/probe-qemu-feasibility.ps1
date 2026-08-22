[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$QemuPath,
  [ValidateRange(1, 30)]
  [int]$StartupTimeoutSeconds = 5
)

$ErrorActionPreference = "Stop"

function Resolve-QemuExecutable {
  param([string]$Path)

  if (Test-Path -LiteralPath $Path -PathType Leaf) {
    return (Resolve-Path -LiteralPath $Path).Path
  }

  $command = Get-Command $Path -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    throw "QEMU executable was not found: $Path"
  }
  return $command.Source
}

function ConvertTo-ProcessArgument {
  param([string]$Argument)

  if ($Argument -notmatch '[\s"]') {
    return $Argument
  }
  if ($Argument.EndsWith('\')) {
    throw "A process argument ending in a backslash is not supported by this probe: $Argument"
  }
  # The probe arguments contain file paths that end in a filename, never a
  # backslash. Quoting the complete argument and escaping only embedded quotes
  # preserves Windows paths instead of rewriting their separators.
  return '"' + $Argument.Replace('"', '\"') + '"'
}

function Invoke-Qemu {
  param(
    [string]$Executable,
    [string[]]$Arguments
  )

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $Executable
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startInfo.Arguments = (($Arguments | ForEach-Object { ConvertTo-ProcessArgument -Argument $_ }) -join ' ')

  $process = [System.Diagnostics.Process]::new()
  $started = $false
  $stdout = $null
  $stderr = $null
  try {
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
      throw "QEMU process could not be started: $Executable"
    }
    $started = $true
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    [pscustomobject]@{
      ExitCode = $process.ExitCode
      Stdout = $stdout.GetAwaiter().GetResult()
      Stderr = $stderr.GetAwaiter().GetResult()
    }
  } finally {
    try {
      if ($started -and -not $process.HasExited) {
        try {
          $process.Kill()
        } catch {
          # The process may have exited between WaitForExit and Kill.
        }
        $process.WaitForExit(5000) | Out-Null
      }
      # Complete redirected reads before closing the process handles.
      if ($null -ne $stdout) {
        $stdout.GetAwaiter().GetResult() | Out-Null
      }
      if ($null -ne $stderr) {
        $stderr.GetAwaiter().GetResult() | Out-Null
      }
    } catch {
      # Preserve the primary process error while still disposing below.
    } finally {
      $process.Close()
      $process.Dispose()
    }
  }
}

function New-ZeroFile {
  param(
    [string]$Path,
    [long]$Length
  )

  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  try {
    $stream.SetLength($Length)
  } finally {
    $stream.Dispose()
  }
}

function Get-ValidatedProbeDirectory {
  param([string]$Path)

  $tempRoot = (Resolve-Path -LiteralPath ([System.IO.Path]::GetTempPath())).Path
  $resolvedPath = if (Test-Path -LiteralPath $Path) {
    (Resolve-Path -LiteralPath $Path).Path
  } else {
    [System.IO.Path]::GetFullPath($Path)
  }
  $resolvedRoot = $tempRoot.TrimEnd('\', '/')
  $fullPath = [System.IO.Path]::GetFullPath($resolvedPath)
  $parent = ([System.IO.Path]::GetDirectoryName($fullPath)).TrimEnd('\', '/')
  $leaf = [System.IO.Path]::GetFileName($fullPath)
  if ($parent -ne $resolvedRoot) {
    throw "Refusing to use a QEMU probe directory outside the direct system-temp child: $fullPath"
  }
  if ($leaf -notmatch '^scoring-qemu-m3-13-\d+$') {
    throw "Refusing to use an unrecognized QEMU probe directory name: $leaf"
  }
  return $fullPath
}

$qemu = Resolve-QemuExecutable -Path $QemuPath
$probeDirectory = Get-ValidatedProbeDirectory -Path (Join-Path ([System.IO.Path]::GetTempPath()) "scoring-qemu-m3-13-$PID")
$probeProcess = $null
$stdoutTask = $null
$stderrTask = $null
$primaryFailure = $null
New-Item -ItemType Directory -Path $probeDirectory | Out-Null

try {
  $version = Invoke-Qemu -Executable $qemu -Arguments @("--version")
  if ($version.ExitCode -ne 0) {
    throw "QEMU --version failed with exit code $($version.ExitCode): $($version.Stderr.Trim())"
  }

  $machines = Invoke-Qemu -Executable $qemu -Arguments @("-machine", "help")
  if ($machines.ExitCode -ne 0 -or $machines.Stdout -notmatch "(?m)^esp32s3\s+") {
    throw "QEMU does not advertise the esp32s3 machine. Output: $($machines.Stdout.Trim())"
  }

  $flash = Join-Path $probeDirectory "blank-4mb.bin"
  $efuse = Join-Path $probeDirectory "blank-efuse-1kb.bin"
  New-ZeroFile -Path $flash -Length (4MB)
  New-ZeroFile -Path $efuse -Length 1KB

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $qemu
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $startupArguments = @(
    "-machine", "esp32s3",
    "-nographic",
    "-S",
    "-drive", "file=$flash,if=mtd,format=raw",
    "-drive", "file=$efuse,if=none,format=raw,id=efuse",
    "-global", "driver=nvram.esp32s3.efuse,property=drive,value=efuse"
  )
  $startInfo.Arguments = (($startupArguments | ForEach-Object { ConvertTo-ProcessArgument -Argument $_ }) -join ' ')

  $probeProcess = [System.Diagnostics.Process]::new()
  $probeProcess.StartInfo = $startInfo
  if (-not $probeProcess.Start()) {
    throw "QEMU S3 startup process could not be started"
  }
  $stdoutTask = $probeProcess.StandardOutput.ReadToEndAsync()
  $stderrTask = $probeProcess.StandardError.ReadToEndAsync()

  # QEMU is a console process, so WaitForInputIdle is not portable across
  # Windows PowerShell and PowerShell 7. A running process after this bounded
  # interval is the observable initialization result.
  Start-Sleep -Seconds $StartupTimeoutSeconds
  $stillRunning = -not $probeProcess.HasExited
  if ($stillRunning) {
    Stop-Process -Id $probeProcess.Id -Force -ErrorAction SilentlyContinue
    if (-not $probeProcess.WaitForExit(5000)) {
      try {
        $probeProcess.Kill()
      } catch {
        # The process may have exited between the status check and Kill.
      }
      $probeProcess.WaitForExit(5000) | Out-Null
    }
  }
  $stdout = $stdoutTask.GetAwaiter().GetResult()
  $stderr = $stderrTask.GetAwaiter().GetResult()
  $exitCode = $probeProcess.ExitCode
  $probeProcess.Close()
  $probeProcess.Dispose()
  $probeProcess = $null

  if (-not $stillRunning) {
    throw "QEMU exited before the bounded S3 startup probe completed (exit $exitCode): $stderr"
  }

  Write-Output "QEMU version: $($version.Stdout.Trim())"
  Write-Output "esp32s3 machine: PASS"
  Write-Output "blank flash and eFuse startup: PASS (process initialized for $StartupTimeoutSeconds seconds)"
  if ($stderr.Trim().Length -gt 0) {
    Write-Output "startup diagnostics: $($stderr.Trim())"
  }
} catch {
  $primaryFailure = $_
  throw
} finally {
  if ($null -ne $probeProcess) {
    try {
      if (-not $probeProcess.HasExited) {
        Stop-Process -Id $probeProcess.Id -Force -ErrorAction SilentlyContinue
        if (-not $probeProcess.WaitForExit(5000)) {
          try {
            $probeProcess.Kill()
          } catch {
            # The process may have exited between the status check and Kill.
          }
          $probeProcess.WaitForExit(5000) | Out-Null
        }
      }
      if ($null -ne $stdoutTask) {
        $stdoutTask.GetAwaiter().GetResult() | Out-Null
      }
      if ($null -ne $stderrTask) {
        $stderrTask.GetAwaiter().GetResult() | Out-Null
      }
    } catch {
      # Cleanup below is best effort; the probe result is already determined.
    }
    $probeProcess.Close()
    $probeProcess.Dispose()
    $probeProcess = $null
  }
  if (Test-Path -LiteralPath $probeDirectory) {
    $cleanupFailure = $null
    try {
      $validatedProbeDirectory = Get-ValidatedProbeDirectory -Path $probeDirectory
      for ($attempt = 1; $attempt -le 5; $attempt++) {
        try {
          Remove-Item -LiteralPath $validatedProbeDirectory -Recurse -Force -ErrorAction Stop
          break
        } catch {
          if ($attempt -eq 5) {
            throw "Could not remove temporary QEMU probe directory after $attempt attempts: $validatedProbeDirectory. $($_.Exception.Message)"
          }
          Start-Sleep -Milliseconds 200
        }
      }
      if (Test-Path -LiteralPath $validatedProbeDirectory) {
        throw "Temporary QEMU probe directory still exists after removal: $validatedProbeDirectory"
      }
    } catch {
      $cleanupFailure = $_
    }
    if ($null -ne $cleanupFailure) {
      if ($null -eq $primaryFailure) {
        throw $cleanupFailure
      }
      Write-Warning "QEMU probe cleanup failed after a primary probe failure: $($cleanupFailure.Exception.Message)"
    }
  }
}
