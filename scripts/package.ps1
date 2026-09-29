$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$source = Join-Path $workspace 'sheetbridge'
$output = Join-Path $workspace 'dist'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$archive = Join-Path $output 'sheetbridge-1.0.1.zip'
Compress-Archive -LiteralPath $source -DestinationPath $archive -Force
Copy-Item -LiteralPath (Join-Path $source 'docs\user-guide.html') -Destination (Join-Path $output 'SheetBridge-User-Guide-AR-EN.html') -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
try {
    $names = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
    if ($names -notcontains 'sheetbridge/sheetbridge.php') { throw 'Plugin root is missing from ZIP.' }
    if ($names | Where-Object { $_ -match '(wp-config|\.env|\.runtime|tests/|scripts/|node_modules|vendor/)' }) { throw 'Unexpected development material in ZIP.' }
    Write-Output ("ZIP verified: {0} entries" -f $names.Count)
} finally { $zip.Dispose() }
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $output 'SHA256SUMS.txt') -Value "$hash  sheetbridge-1.0.1.zip" -Encoding ASCII
Write-Output "Created $archive"

