Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$bpDir = $PSScriptRoot
$root = Split-Path -Parent $bpDir
$rpDir = Join-Path $root "Cetros do Arquiteto RP"
$outPath = Join-Path $root "Cetros_do_Arquiteto_v4.0.0.mcaddon"

Get-ChildItem -LiteralPath $root -Filter "*.mcaddon" -File -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force
}

$allowedBpRootFiles = @("manifest.json", "pack_icon.png")
$allowedBpDirs = @("blocks", "item_catalog", "items", "recipes", "scripts")

$zipStream = [System.IO.File]::Open($outPath, [System.IO.FileMode]::Create)
try {
    $zip = New-Object System.IO.Compression.ZipArchive($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        foreach ($fname in $allowedBpRootFiles) {
            $fpath = Join-Path $bpDir $fname
            if (Test-Path -LiteralPath $fpath) {
                $entryName = "Cetros do Arquiteto BP/$fname"
                [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $fpath, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
            }
        }
        foreach ($dname in $allowedBpDirs) {
            $dpath = Join-Path $bpDir $dname
            if (Test-Path -LiteralPath $dpath) {
                Get-ChildItem -LiteralPath $dpath -Recurse -File | ForEach-Object {
                    $rel = $_.FullName.Substring($bpDir.Length + 1).Replace('\', '/')
                    $entryName = "Cetros do Arquiteto BP/$rel"
                    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
                }
            }
        }
        Get-ChildItem -LiteralPath $rpDir -Recurse -File | ForEach-Object {
            $rel = $_.FullName.Substring($rpDir.Length + 1).Replace('\', '/')
            $entryName = "Cetros do Arquiteto RP/$rel"
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $entryName, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally {
        $zip.Dispose()
    }
} finally {
    $zipStream.Dispose()
}

Write-Host "Built: $outPath"