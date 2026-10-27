$ErrorActionPreference = 'Stop'

$helper = Join-Path (Split-Path -Parent $PSScriptRoot) 'rollback-production.ps1'
$parserErrors = $null
[void] [System.Management.Automation.Language.Parser]::ParseFile(
    $helper,
    [ref] $null,
    [ref] $parserErrors
)
if ($parserErrors.Count -gt 0) {
    $details = ($parserErrors | ForEach-Object { $_.Message }) -join '; '
    throw ('PowerShell parser validation failed: {0}' -f $details)
}

$testParserErrors = $null
[void] [System.Management.Automation.Language.Parser]::ParseFile(
    $PSCommandPath,
    [ref] $null,
    [ref] $testParserErrors
)
if ($testParserErrors.Count -gt 0) {
    $details = ($testParserErrors | ForEach-Object { $_.Message }) -join '; '
    throw ('PowerShell test parser validation failed: {0}' -f $details)
}

& $helper -SelfTest
Write-Output 'PowerShell syntax and mocked/dry-run validation passed.'
