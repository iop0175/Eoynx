Param(
  [Parameter(Mandatory = $true)]
  [string]$PackageName,

  [int]$DurationMinutes = 15,
  [int]$SampleIntervalSeconds = 30,
  [string]$OutputDir = "C:\git\Eoynx\eoynx-mobile\perf-artifacts"
)

$ErrorActionPreference = "Stop"

if ($DurationMinutes -le 0) { throw "DurationMinutes must be > 0" }
if ($SampleIntervalSeconds -le 0) { throw "SampleIntervalSeconds must be > 0" }

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sessionDir = Join-Path $OutputDir "dm_lowend_$timestamp"
New-Item -ItemType Directory -Path $sessionDir -Force | Out-Null

$metaPath = Join-Path $sessionDir "session-meta.txt"
"start=$(Get-Date -Format o)" | Out-File -FilePath $metaPath -Encoding utf8
"package=$PackageName" | Out-File -FilePath $metaPath -Append -Encoding utf8
"durationMinutes=$DurationMinutes" | Out-File -FilePath $metaPath -Append -Encoding utf8
"sampleIntervalSeconds=$SampleIntervalSeconds" | Out-File -FilePath $metaPath -Append -Encoding utf8

Write-Host "[DM-LowEnd] Output: $sessionDir" -ForegroundColor Cyan

# Basic device info
adb devices | Out-File -FilePath (Join-Path $sessionDir "adb-devices.txt") -Encoding utf8
adb shell getprop ro.product.model | Out-File -FilePath (Join-Path $sessionDir "device-model.txt") -Encoding utf8
adb shell getprop ro.build.version.release | Out-File -FilePath (Join-Path $sessionDir "android-version.txt") -Encoding utf8

# Start logcat capture in background
$logcatPath = Join-Path $sessionDir "logcat.txt"
$logcatProc = Start-Process -FilePath "adb" -ArgumentList @("logcat", "-v", "time") -NoNewWindow -RedirectStandardOutput $logcatPath -PassThru

try {
  $totalSeconds = $DurationMinutes * 60
  $elapsed = 0
  $sampleIndex = 0

  while ($elapsed -lt $totalSeconds) {
    $sampleIndex += 1
    $samplePrefix = "sample_{0:D3}" -f $sampleIndex

    adb shell dumpsys meminfo $PackageName | Out-File -FilePath (Join-Path $sessionDir "$samplePrefix-meminfo.txt") -Encoding utf8
    adb shell dumpsys gfxinfo $PackageName | Out-File -FilePath (Join-Path $sessionDir "$samplePrefix-gfxinfo.txt") -Encoding utf8
    adb shell dumpsys battery | Out-File -FilePath (Join-Path $sessionDir "$samplePrefix-battery.txt") -Encoding utf8

    Start-Sleep -Seconds $SampleIntervalSeconds
    $elapsed += $SampleIntervalSeconds
    Write-Host "[DM-LowEnd] Progress: $elapsed / $totalSeconds sec"
  }
}
finally {
  if ($logcatProc -and -not $logcatProc.HasExited) {
    Stop-Process -Id $logcatProc.Id -Force
  }

  "end=$(Get-Date -Format o)" | Out-File -FilePath $metaPath -Append -Encoding utf8
  Write-Host "[DM-LowEnd] Completed. Artifacts: $sessionDir" -ForegroundColor Green
}
