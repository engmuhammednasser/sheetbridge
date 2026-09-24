$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $workspace
$files = Get-ChildItem -LiteralPath (Join-Path $workspace 'sheetbridge') -Recurse -Filter '*.php'
foreach ($file in $files) {
    & php -l $file.FullName
    if ($LASTEXITCODE -ne 0) { throw "PHP syntax failed: $($file.Name)" }
}
& node --check sheetbridge/assets/admin.js
if ($LASTEXITCODE -ne 0) { throw 'Admin JavaScript syntax failed.' }
& php tests/unit.php
if ($LASTEXITCODE -ne 0) { throw 'Domain validation tests failed.' }
& node tests/connector.test.cjs
if ($LASTEXITCODE -ne 0) { throw 'Connector tests failed.' }
Write-Output 'Syntax, domain validation and connector checks passed.'

