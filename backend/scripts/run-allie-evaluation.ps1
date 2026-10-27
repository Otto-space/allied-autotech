# Explicit isolated evaluation only. Never enables the app or edits environment files.
[CmdletBinding()]
param([ValidateRange(1,110)][int]$Count = 110, [ValidateRange(0,109)][int]$Offset = 0, [switch]$Browser, [ValidatePattern('^[a-z0-9_-]+(?:,[a-z0-9_-]+)*$')][string]$Cases = '')
$ErrorActionPreference = 'Stop'
if ($Browser -and -not $PSBoundParameters.ContainsKey('Count')) { $Count = 3 }
if ($Browser -and $Count -gt 3) { throw 'Browser evaluation allows only one to three reserved calls.' }
$configurationPath = Join-Path $env:LOCALAPPDATA 'AlliedAutoTech\allie-evaluation\provider.local.json'
$secureKey = $null
$pointer = [IntPtr]::Zero
try {
    $configuration = Get-Content -Raw -LiteralPath $configurationPath | ConvertFrom-Json
    if ($configuration.version -ne 1 -or $configuration.purpose -ne 'isolated-allie-evaluation' -or
        $configuration.keyProtection -ne 'windows-current-user-dpapi' -or
        $configuration.projectHardLimitConfirmed -ne $true -or $configuration.providerCallsApproved -ne $true) {
        throw 'The local isolated-evaluation approval is incomplete.'
    }
    & powershell -NoProfile -File C:/Users/PC/.codex/scripts/assert-disk-space.ps1 -ExpectedGrowthGiB 0.05
    if ($LASTEXITCODE -ne 0) { throw 'Disk reserve check failed.' }
    $secureKey = ConvertTo-SecureString $configuration.encryptedApiKey
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $payload = @{
        version = 1; purpose = $configuration.purpose; projectLabel = $configuration.projectLabel
        model = $configuration.model; configuredAt = $configuration.configuredAt
        maxEvaluationUsd = $configuration.maxEvaluationUsd; maxProviderRequests = $configuration.maxProviderRequests
        apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    } | ConvertTo-Json -Compress
    # Secret goes only through the child's stdin, never command arguments or logs.
    $backendDirectory = Split-Path -Parent $PSScriptRoot
    Push-Location -LiteralPath $backendDirectory
    try {
        $entrypoint = if ($Browser) { Join-Path $backendDirectory 'tests\helpers\allie-real-provider-server.ts' } else { Join-Path $PSScriptRoot 'run-allie-evaluation.ts' }
        $evaluationArguments = @($entrypoint, '--count', $Count, '--offset', $Offset)
        if ($Cases) { $evaluationArguments += @('--cases', $Cases) }
        $payload | & node (Join-Path $backendDirectory 'node_modules\tsx\dist\cli.mjs') @evaluationArguments
        if ($LASTEXITCODE -ne 0) { throw 'Isolated evaluation stopped; review its non-secret receipt.' }
    } finally { Pop-Location }
} finally {
    $payload = $null
    $configuration = $null
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($secureKey) { $secureKey.Dispose() }
}
