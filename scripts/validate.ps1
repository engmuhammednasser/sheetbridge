$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $workspace
$files = Get-ChildItem -LiteralPath (Join-Path $workspace 'sheetbridge') -Recurse -Filter '*.php'
foreach ($file in $files) {
    & php -l $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "PHP syntax failed: $($file.Name)" }
}
$header = Get-Content sheetbridge/sheetbridge.php -Raw
$version = [regex]::Match($header, '(?m)^ \* Version: (\d+\.\d+\.\d+)\s*$').Groups[1].Value
if (-not (Test-Path "sheetbridge/assets/admin-$version.css")) { throw 'Versioned admin stylesheet is missing.' }
& node --check "sheetbridge/assets/admin-$version.js"
if ($LASTEXITCODE -ne 0) { throw 'Admin JavaScript syntax failed.' }
& php tests/unit.php
if ($LASTEXITCODE -ne 0) { throw 'Domain validation tests failed.' }
& node tests/connector.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'Connector tests failed.' }
& php tests/updater.php
if ($LASTEXITCODE -ne 0) { throw 'Updater tests failed.' }
Write-Output 'Syntax, domain validation, connector and updater checks passed.'

