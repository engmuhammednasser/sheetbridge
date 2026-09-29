$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$source = Join-Path $workspace 'sheetbridge'
$output = Join-Path $workspace 'dist'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$archive = Join-Path $output 'sheetbridge-1.0.1.zip'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$files = @(Get-ChildItem -LiteralPath $source -Recurse -File)
$stream = [System.IO.File]::Open($archive, [System.IO.FileMode]::Create)
try {
    $zip = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create, $true)
    try {
        foreach ($file in $files) {
            # ZIP entry names must use forward slashes, including builds on Windows.
            $relativePath = $file.FullName.Substring($source.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, "sheetbridge/$relativePath", [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $zip.Dispose() }
} finally { $stream.Dispose() }
Copy-Item -LiteralPath (Join-Path $source 'docs\user-guide.html') -Destination (Join-Path $output 'SheetBridge-User-Guide-AR-EN.html') -Force
$zip = [System.IO.Compression.ZipFile]::OpenRead($archive)
try {
    $names = @($zip.Entries | ForEach-Object { $_.FullName })
    if ($names | Where-Object { $_.Contains('\') -or -not $_.StartsWith('sheetbridge/') }) { throw 'ZIP entries must use a sheetbridge/ root and forward slashes.' }
    if ($names.Count -ne $files.Count -or @($names | Sort-Object -Unique).Count -ne $files.Count) { throw 'ZIP file count or uniqueness check failed.' }
    if ($names -notcontains 'sheetbridge/sheetbridge.php') { throw 'Plugin root is missing from ZIP.' }
    if ($names | Where-Object { $_ -match '(wp-config|\.env|\.runtime|tests/|scripts/|node_modules|vendor/)' }) { throw 'Unexpected development material in ZIP.' }
    Write-Output ("ZIP verified: {0} entries" -f $names.Count)
} finally { $zip.Dispose() }
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $output 'SHA256SUMS.txt') -Value "$hash  sheetbridge-1.0.1.zip" -Encoding ASCII
Write-Output "Created $archive"

