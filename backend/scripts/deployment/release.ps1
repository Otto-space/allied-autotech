param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('preflight', 'init', 'keys', 'private-access', 'build', 'push', 'spec', 'validate')]
    [string]$Action
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
& node (Join-Path $PSScriptRoot 'release.mjs') $Action
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
