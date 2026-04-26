param(
    [Parameter(Mandatory = $true)]
    [string]$ExtensionId,
    [switch]$Edge
)

$ErrorActionPreference = 'Stop'

$hostName = 'com.clip_dl.clip_downloader'
$legacyHostName = 'com.clip_dl.duration_click_logger'
$legacyDashedHostName = 'com.clip-dl.duration-click-logger'
$generatedDirectory = Join-Path $PSScriptRoot '.generated'
$manifestPath = Join-Path $generatedDirectory 'com.clip-dl.clip-downloader.json'
$launcherPath = Join-Path $PSScriptRoot 'run_clip_downloader.cmd'

if (-not ($ExtensionId -match '^[a-p]{32}$')) {
    throw 'ExtensionId must be the 32-character Chromium extension ID from chrome://extensions.'
}

New-Item -Path $generatedDirectory -ItemType Directory -Force | Out-Null

$manifest = @{
    name = $hostName
    description = 'clip-dl native host for yt-dlp clip downloads'
    path = $launcherPath
    type = 'stdio'
    allowed_origins = @(
        "chrome-extension://$ExtensionId/"
    )
}

# The manifest is generated at install time so the extension ID and local repo
# path always match the machine where the host is being registered. Checking in
# a fixed manifest would go stale every time the extension ID or clone path
# changed, which is the exact failure mode native messaging is worst at
# explaining from the browser UI.
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

$registryRoots = @(
    'HKCU:\Software\Google\Chrome\NativeMessagingHosts\' + $hostName
)

if ($Edge) {
    $registryRoots += 'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\' + $hostName
}

$legacyRegistryRoots = @(
    'HKCU:\Software\Google\Chrome\NativeMessagingHosts\' + $legacyHostName,
    'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\' + $legacyHostName,
    'HKCU:\Software\Google\Chrome\NativeMessagingHosts\' + $legacyDashedHostName,
    'HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\' + $legacyDashedHostName
)

foreach ($legacyRoot in $legacyRegistryRoots) {
    if (Test-Path $legacyRoot) {
        Remove-Item -Path $legacyRoot -Recurse -Force -ErrorAction SilentlyContinue
        & reg.exe delete ($legacyRoot -replace '^HKCU:', 'HKCU') /f | Out-Null
        Write-Host "Removed legacy host registration: $legacyRoot"
    }
}

foreach ($root in $registryRoots) {
    New-Item -Path $root -Force | Out-Null
    & reg.exe add ($root -replace '^HKCU:', 'HKCU') /ve /t REG_SZ /d $manifestPath /f | Out-Null
    Write-Host "Registered native host: $root -> $manifestPath"
}

Write-Host ''
Write-Host 'Registration complete.'
Write-Host "Generated manifest: $manifestPath"
Write-Host 'Restart Chrome/Edge, then click one of the duration buttons in YouTube to test.'
