# Local Windows setup only. Does not call a provider, change app settings or deploy.
[CmdletBinding()]
param([switch]$KeyFromClipboard)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'This helper requires Windows current-user secret protection.' }
$configDirectory = Join-Path $env:LOCALAPPDATA 'AlliedAutoTech\allie-evaluation'
$configPath = Join-Path $configDirectory 'provider.local.json'
if (Test-Path -LiteralPath $configPath) {
    throw "Configuration already exists at $configPath. Existing credentials have been preserved."
}
$ancestorPath = $configDirectory
while ($ancestorPath) {
    if ((Test-Path -LiteralPath $ancestorPath) -and
        ((Get-Item -LiteralPath $ancestorPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw 'A configuration-directory ancestor is a reparse point. Stop and review the destination.'
    }
    $ancestorPath = Split-Path -Path $ancestorPath -Parent
}

$projectLabel = (Read-Host 'Dedicated OpenAI test project name').Trim()
if ($projectLabel.Length -lt 1 -or $projectLabel.Length -gt 120) { throw 'Enter a short project name.' }
$model = (Read-Host 'Model ID (Enter for suggested gpt-6-luna)').Trim()
if (-not $model) { $model = 'gpt-6-luna' }
if ($model -notmatch '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$') { throw 'Invalid model ID.' }

$budgetText = (Read-Host 'Maximum USD you approve for the isolated evaluation (for example 1.00)').Trim()
[decimal]$budgetUsd = 0
if (-not [decimal]::TryParse($budgetText, [Globalization.NumberStyles]::AllowDecimalPoint,
        [Globalization.CultureInfo]::InvariantCulture, [ref]$budgetUsd) -or
    $budgetUsd -le 0 -or $budgetUsd -gt 100) {
    throw 'Enter a positive USD evaluation limit of at most 100. No spending has occurred.'
}
$hardLimit = (Read-Host 'Have you enabled the project hard spend limit? Type YES to confirm').Trim()
if ($hardLimit -ine 'YES') { throw 'Configure the project hard limit first. Nothing was saved.' }
$secret = $null
$clipboardKey = $null
try {
    if ($KeyFromClipboard) {
        Write-Output 'Now switch to OpenAI and use Copy for the full secret key. Do not copy any command or other text afterward.'
        [void](Read-Host 'Return to this terminal and press Enter after copying the key; do not paste it here')
        try { $clipboardKey = Get-Clipboard -Raw -ErrorAction Stop }
        catch { throw 'Could not read the clipboard. Copy the secret key using the OpenAI Copy button, then retry locally.' }
        if ($clipboardKey -isnot [string] -or $clipboardKey.Trim() -notmatch '^\S{20,1000}$') {
            throw 'The clipboard does not contain a complete key. Copy the secret key using the OpenAI Copy button, then retry locally.'
        }
        $secret = ConvertTo-SecureString $clipboardKey.Trim() -AsPlainText -Force
        $clipboardKey = $null
    } else {
        $secret = Read-Host 'Paste the project API key here (hidden; never paste it into chat)' -AsSecureString
    }
    if ($secret.Length -lt 20 -or $secret.Length -gt 1000) { throw 'API key length is invalid.' }
    $configuration = [ordered]@{
        version = 1
        purpose = 'isolated-allie-evaluation'
        projectLabel = $projectLabel
        model = $model
        maxEvaluationUsd = $budgetUsd
        maxProviderRequests = 120
        projectHardLimitConfirmed = $true
        providerCallsApproved = $true
        configuredAt = [DateTime]::UtcNow.ToString('o')
        keyProtection = 'windows-current-user-dpapi'
        encryptedApiKey = ConvertFrom-SecureString -SecureString $secret
    }
    [void][IO.Directory]::CreateDirectory($configDirectory)
    $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($configuration | ConvertTo-Json -Depth 3))
    $stream = [IO.File]::Open($configPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    Write-Output "Saved Windows-user-encrypted evaluation settings to $configPath"
    Write-Output 'No API request, app enablement, environment-file change or deployment was performed.'
} finally {
    $clipboardKey = $null
    if ($secret) { $secret.Dispose() }
}
