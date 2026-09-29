$ErrorActionPreference = 'Stop'
$workspace = Split-Path -Parent $PSScriptRoot
$source = Join-Path $workspace 'sheetbridge'
$output = Join-Path $workspace 'dist'
New-Item -ItemType Directory -Force -Path $output | Out-Null
$header = Get-Content -LiteralPath (Join-Path $source 'sheetbridge.php') -Raw
$versionMatch = [regex]::Match($header, '(?m)^ \* Version: (\d+\.\d+\.\d+)\s*$')
if (-not $versionMatch.Success) { throw 'Plugin version header is missing or invalid.' }
$version = $versionMatch.Groups[1].Value
$archiveName = "sheetbridge-$version.zip"
$archive = Join-Path $output $archiveName
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
Set-Content -LiteralPath (Join-Path $output 'SHA256SUMS.txt') -Value "$hash  $archiveName" -Encoding ASCII
$notes = Get-Content -LiteralPath (Join-Path $workspace "releases/$version.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$manifest = [ordered]@{
    schema = 1
    slug = 'sheetbridge'
    version = $version
    requires = [regex]::Match($header, '(?m)^ \* Requires at least: ([\d.]+)').Groups[1].Value
    requires_php = [regex]::Match($header, '(?m)^ \* Requires PHP: ([\d.]+)').Groups[1].Value
    tested = $notes.tested
    package = "https://github.com/engmuhammednasser/sheetbridge/releases/download/v$version/$archiveName"
    sha256 = $hash
    published_at = $notes.published_at
    changelog_en = $notes.changelog_en
    changelog_ar = $notes.changelog_ar
}
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $output 'sheetbridge-update.json'), ($manifest | ConvertTo-Json -Depth 4) + "`n", $utf8)
Write-Output "Created $archive"
Write-Output 'Publish the GitHub release asset before copying dist/sheetbridge-update.json to updates/stable.json.'

