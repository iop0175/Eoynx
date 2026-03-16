Param(
  [string]$EnvFilePath = "C:\git\Eoynx\eoynx-app\.env.local"
)

$ErrorActionPreference = "Stop"

function Import-EnvFile {
  param([string]$Path)

  if (!(Test-Path $Path)) {
    throw "Env file not found: $Path"
  }

  Get-Content $Path | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -match '^\s*$') { return }
    $parts = $_ -split '=', 2
    if ($parts.Length -eq 2) {
      [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
    }
  }
}

function Run-Step {
  param(
    [string]$Title,
    [string]$WorkingDir,
    [string]$Command
  )

  Write-Host "\n==> $Title" -ForegroundColor Cyan
  Push-Location $WorkingDir
  try {
    Invoke-Expression $Command
    if ($LASTEXITCODE -ne 0) {
      throw "$Title failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

Import-EnvFile -Path $EnvFilePath

Run-Step -Title "Web social regression" -WorkingDir "C:\git\Eoynx\eoynx-app" -Command "npm run qa:social-regression"
Run-Step -Title "Mobile social regression" -WorkingDir "C:\git\Eoynx\eoynx-mobile" -Command "npm run qa:social-regression"

Write-Host "\nAll social regression checks passed." -ForegroundColor Green
