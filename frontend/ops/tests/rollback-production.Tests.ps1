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

$script:ExpectedDeploymentId = 'dpl_J5k6BjFUZVTFgeGJSrH4WHhiFxcq'
$script:ExpectedProjectId = 'prj_LbuHFZ0EY8fBQL2pcOP1L3YHK2cb'
$script:ExpectedScope = 'michael-enochs-projects-3da06943'
$script:ExpectedCommit = 'fbb6565a57e484f802e1317d82f6631c55b34b03'
$global:RollbackGuardMutationCalls = New-Object 'System.Collections.Generic.List[object]'
$global:RollbackGuardDeploymentListRequests = New-Object 'System.Collections.Generic.List[string]'
$script:Scenario = $null
$script:TypedConfirmation = $null

function vercel {
    param([Parameter(ValueFromRemainingArguments = $true)] [object[]] $CliArguments)

    $cliArgs = @($CliArguments | ForEach-Object { [string] $_ })
    if ($cliArgs.Count -eq 0) {
        throw 'Mock CLI received an empty command.'
    }

    if ($cliArgs[0] -eq 'rollback' -and $cliArgs.Count -gt 1 -and $cliArgs[1] -eq 'status') {
        return $global:RollbackGuardScenario.RollbackStatus
    }
    if ($cliArgs[0] -eq 'rollback') {
        $global:RollbackGuardMutationCalls.Add([string[]] $cliArgs)
        return 'stub rollback accepted'
    }
    if ($cliArgs[0] -ne 'api' -or $cliArgs.Count -lt 2) {
        throw 'Mock CLI received an unexpected Vercel command.'
    }

    $scopeIndex = [Array]::IndexOf($cliArgs, '--scope')
    if ($scopeIndex -lt 0 -or
        $scopeIndex + 1 -ge $cliArgs.Count -or
        $cliArgs[$scopeIndex + 1] -cne $script:ExpectedScope) {
        throw 'Mock CLI received an unexpected Vercel scope.'
    }

    $endpoint = $cliArgs[1]
    if ($endpoint.StartsWith('/v9/projects/', [System.StringComparison]::Ordinal)) {
        return ConvertTo-Json -Compress -InputObject @{
            id = $global:RollbackGuardScenario.ProjectId
            name = $global:RollbackGuardScenario.ProjectName
        }
    }
    if ($endpoint.StartsWith('/v13/deployments/', [System.StringComparison]::Ordinal)) {
        return ConvertTo-Json -Compress -InputObject @{
            id = $global:RollbackGuardScenario.DeploymentId
            projectId = $global:RollbackGuardScenario.ProjectId
            target = 'production'
            readyState = $global:RollbackGuardScenario.TargetReadyState
            gitSource = @{ sha = $global:RollbackGuardScenario.Commit }
        }
    }
    if ($endpoint.StartsWith('/v7/deployments?', [System.StringComparison]::Ordinal)) {
        $global:RollbackGuardDeploymentListRequests.Add($endpoint)
        if ($global:RollbackGuardScenario.RawDeploymentResponse -is [string]) {
            return $global:RollbackGuardScenario.RawDeploymentResponse
        }

        $cursorMatch = [regex]::Match($endpoint, '(?:^|&)until=(\d+)')
        $pageIndex = 0
        if ($cursorMatch.Success) {
            $cursor = $cursorMatch.Groups[1].Value
            $pageIndex = [Array]::IndexOf([string[]] $global:RollbackGuardScenario.PageCursors, $cursor) + 1
        }
        if ($pageIndex -lt 0 -or $pageIndex -ge $global:RollbackGuardScenario.Pages.Count) {
            throw 'Mock CLI received an unexpected deployment pagination cursor.'
        }

        return ConvertTo-Json -Depth 8 -Compress -InputObject $global:RollbackGuardScenario.Pages[$pageIndex]
    }

    throw 'Mock CLI received an unexpected Vercel API endpoint.'
}

function Read-Host {
    param([string] $Prompt)
    return $global:RollbackGuardTypedConfirmation
}

function New-Page {
    param(
        [object[]] $Deployments,
        [int] $Count,
        [AllowNull()] [string] $Next
    )

    return @{
        deployments = @($Deployments)
        pagination = @{ count = [string] $Count; next = $Next }
    }
}

function New-SafeScenario {
    return @{
        ProjectId = $script:ExpectedProjectId
        ProjectName = 'allied-autotech'
        DeploymentId = $script:ExpectedDeploymentId
        TargetReadyState = 'READY'
        Commit = $script:ExpectedCommit
        RollbackStatus = 'No pending rollbacks found.'
        PageCursors = @()
        Pages = @(
            (New-Page -Deployments @(@{ id = 'dpl-current'; readyState = 'READY' }) -Count 1 -Next $null)
        )
        RawDeploymentResponse = $null
    }
}

function Reset-Mocks {
    param([hashtable] $NewScenario)

    $global:RollbackGuardScenario = $NewScenario
    $script:TypedConfirmation = 'not-approved'
    $global:RollbackGuardTypedConfirmation = 'not-approved'
    $global:RollbackGuardMutationCalls.Clear()
    $global:RollbackGuardDeploymentListRequests.Clear()
}

function Assert-NoMutation {
    param([string] $Case)

    if ($global:RollbackGuardMutationCalls.Count -ne 0) {
        throw ('{0}: expected zero rollback mutations, observed {1}.' -f $Case, $global:RollbackGuardMutationCalls.Count)
    }
}

function Assert-RejectedWithoutMutation {
    param(
        [string] $Case,
        [hashtable] $NewScenario,
        [switch] $Execute
    )

    Reset-Mocks $NewScenario
    $rejected = $false
    try {
        if ($Execute) {
            & $helper -ExecuteRollback -Confirm:$false | Out-Null
        }
        else {
            & $helper | Out-Null
        }
    }
    catch {
        $rejected = $true
    }

    if (-not $rejected) {
        throw ('{0}: helper entrypoint did not reject the unsafe/ambiguous state.' -f $Case)
    }
    Assert-NoMutation $Case
}

function Assert-InteractiveConfirmationDeclined {
    $projectJson = ConvertTo-Json -Compress -InputObject @{
        id = $script:ExpectedProjectId
        name = 'allied-autotech'
    }
    $deploymentJson = ConvertTo-Json -Compress -InputObject @{
        id = $script:ExpectedDeploymentId
        projectId = $script:ExpectedProjectId
        target = 'production'
        readyState = 'READY'
        gitSource = @{ sha = $script:ExpectedCommit }
    }
    $listJson = ConvertTo-Json -Compress -InputObject @{
        deployments = @(@{ id = 'dpl-current'; readyState = 'READY' })
        pagination = @{ count = '1'; next = $null }
    }

    $childScript = @"
function global:vercel {
    param([Parameter(ValueFromRemainingArguments = `$true)] [object[]] `$CliArguments)
    if (`$CliArguments[0] -eq 'rollback' -and `$CliArguments[1] -eq 'status') {
        return 'No pending rollbacks found.'
    }
    if (`$CliArguments[0] -eq 'rollback') {
        Write-Output 'ROLLBACK_MUTATION_SENTINEL'
        return
    }
    if (`$CliArguments[1].StartsWith('/v9/projects/', [System.StringComparison]::Ordinal)) {
        return '$projectJson'
    }
    if (`$CliArguments[1].StartsWith('/v13/deployments/', [System.StringComparison]::Ordinal)) {
        return '$deploymentJson'
    }
    if (`$CliArguments[1].StartsWith('/v7/deployments?', [System.StringComparison]::Ordinal)) {
        return '$listJson'
    }
    throw 'Unexpected mocked Vercel command.'
}
& '$helper' -ExecuteRollback -Confirm
"@
    $encodedCommand = [Convert]::ToBase64String(
        [System.Text.Encoding]::Unicode.GetBytes($childScript)
    )
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = (Get-Command 'powershell.exe' -ErrorAction Stop).Source
    $startInfo.Arguments = '-NoProfile -ExecutionPolicy Bypass -EncodedCommand {0}' -f $encodedCommand
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
        throw 'Could not start isolated PowerShell confirmation test.'
    }
    $process.StandardInput.WriteLine('N')
    $process.StandardInput.Close()
    if (-not $process.WaitForExit(15000)) {
        Stop-Process -Id $process.Id
        throw 'Isolated confirmation-decline test did not finish promptly.'
    }

    $output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
    if ($process.ExitCode -ne 0 -or $output.Contains('ROLLBACK_MUTATION_SENTINEL')) {
        throw ('Declining the PowerShell confirmation did not safely stop the helper. Output: {0}' -f $output)
    }
}

$savedConfirmPreference = $ConfirmPreference
try {
    # Keep tests deterministic and non-interactive; the helper still reaches its
    # real ShouldProcess and typed-confirmation gates.
    $ConfirmPreference = 'None'

    # Actual no-switch helper entrypoint is read-only and completes the full preflight.
    Reset-Mocks (New-SafeScenario)
    & $helper | Out-Null
    Assert-NoMutation 'default no-switch dry run'

    # -WhatIf reaches ShouldProcess but must not cross the CLI mutation boundary.
    Reset-Mocks (New-SafeScenario)
    & $helper -ExecuteRollback -WhatIf | Out-Null
    Assert-NoMutation '-WhatIf'

    # Exercise an actual interactive ShouldProcess decline in a separate host.
    Assert-InteractiveConfirmationDeclined

    # A wrong typed deployment confirmation independently rejects after
    # ShouldProcess approval.
    Reset-Mocks (New-SafeScenario)
    $script:TypedConfirmation = 'dpl_not-the-pinned-deployment'
    $global:RollbackGuardTypedConfirmation = $script:TypedConfirmation
    $mismatchRejected = $false
    try {
        & $helper -ExecuteRollback -Confirm:$false | Out-Null
    }
    catch {
        $mismatchRejected = $true
    }
    if (-not $mismatchRejected) {
        throw 'Mismatched typed confirmation was not rejected.'
    }
    Assert-NoMutation 'mismatched typed confirmation'

    # Test the only approved path with a stubbed CLI and compare every mutation
    # argument to the immutable target and scope.
    Reset-Mocks (New-SafeScenario)
    $script:TypedConfirmation = $script:ExpectedDeploymentId
    $global:RollbackGuardTypedConfirmation = $script:TypedConfirmation
    & $helper -ExecuteRollback -Confirm:$false | Out-Null
    if ($global:RollbackGuardMutationCalls.Count -ne 1) {
        throw ('Explicit approval must issue exactly one stubbed rollback; observed {0}.' -f $global:RollbackGuardMutationCalls.Count)
    }
    $expectedMutation = @(
        'rollback',
        $script:ExpectedDeploymentId,
        '--scope',
        $script:ExpectedScope
    )
    $actualMutation = [string[]] $global:RollbackGuardMutationCalls[0]
    if (($actualMutation -join [char] 0) -cne ($expectedMutation -join [char] 0)) {
        throw ('Approved mutation arguments were not the exact pinned target/scope: {0}' -f ($actualMutation -join ' '))
    }

    $activeRollback = New-SafeScenario
    $activeRollback.RollbackStatus = 'Rollback status: IN_PROGRESS'
    Assert-RejectedWithoutMutation 'active rollback' $activeRollback -Execute

    $wrongProject = New-SafeScenario
    $wrongProject.ProjectId = 'prj_wrong'
    Assert-RejectedWithoutMutation 'project identity mismatch' $wrongProject -Execute

    $wrongDeployment = New-SafeScenario
    $wrongDeployment.DeploymentId = 'dpl_wrong'
    Assert-RejectedWithoutMutation 'pinned deployment mismatch' $wrongDeployment -Execute

    $wrongSource = New-SafeScenario
    $wrongSource.Commit = '0' * 40
    Assert-RejectedWithoutMutation 'pinned source commit mismatch' $wrongSource -Execute

    $unreadyTarget = New-SafeScenario
    $unreadyTarget.TargetReadyState = 'BUILDING'
    Assert-RejectedWithoutMutation 'pinned deployment not READY' $unreadyTarget -Execute

    $unknownRollback = New-SafeScenario
    $unknownRollback.RollbackStatus = 'Rollback state: ???'
    Assert-RejectedWithoutMutation 'unknown rollback status' $unknownRollback -Execute

    $pendingOnSecondPage = New-SafeScenario
    $pendingOnSecondPage.PageCursors = @('1700000000000')
    $pendingOnSecondPage.Pages = @(
        (New-Page -Deployments @(@{ id = 'dpl-first-page'; readyState = 'READY' }) -Count 1 -Next '1700000000000'),
        (New-Page -Deployments @(@{ id = 'dpl-pending-later'; readyState = 'QUEUED' }) -Count 1 -Next $null)
    )
    Assert-RejectedWithoutMutation 'pending deployment on paginated page' $pendingOnSecondPage -Execute

    $safePagination = New-SafeScenario
    $safePagination.PageCursors = @('1700000000000')
    $safePagination.Pages = @(
        (New-Page -Deployments @(@{ id = 'dpl-first-page'; readyState = 'READY' }) -Count 1 -Next '1700000000000'),
        (New-Page -Deployments @(@{ id = 'dpl-second-page'; readyState = 'ERROR' }) -Count 1 -Next $null)
    )
    Reset-Mocks $safePagination
    & $helper | Out-Null
    Assert-NoMutation 'complete pagination dry run'
    if ($global:RollbackGuardDeploymentListRequests.Count -ne 2 -or
        $global:RollbackGuardDeploymentListRequests[1] -notmatch '&until=1700000000000(?:&|$)') {
        throw 'Paginated safe scenario did not provide the expected two pages.'
    }

    $missingList = New-SafeScenario
    $missingList.RawDeploymentResponse = '{"pagination":{"count":"1","next":null}}'
    Assert-RejectedWithoutMutation 'missing deployment list' $missingList -Execute

    $emptyList = New-SafeScenario
    $emptyList.Pages = @((New-Page -Deployments @() -Count 0 -Next $null))
    Assert-RejectedWithoutMutation 'empty deployment list' $emptyList -Execute

    $malformedList = New-SafeScenario
    $malformedList.RawDeploymentResponse = '{not-json'
    Assert-RejectedWithoutMutation 'malformed deployment response' $malformedList -Execute

    $missingPagination = New-SafeScenario
    $missingPagination.Pages = @(@{
        deployments = @(@{ id = 'dpl-unverified'; readyState = 'READY' })
    })
    Assert-RejectedWithoutMutation 'missing pagination metadata' $missingPagination -Execute

    $missingCursorField = New-SafeScenario
    $missingCursorField.Pages = @(@{
        deployments = @(@{ id = 'dpl-unverified'; readyState = 'READY' })
        pagination = @{ count = '1' }
    })
    Assert-RejectedWithoutMutation 'missing pagination cursor field' $missingCursorField -Execute

    $unknownDeploymentState = New-SafeScenario
    $unknownDeploymentState.Pages = @(
        (New-Page -Deployments @(@{ id = 'dpl-unknown'; readyState = 'UNRECOGNIZED' }) -Count 1 -Next $null)
    )
    Assert-RejectedWithoutMutation 'unknown deployment state' $unknownDeploymentState -Execute

    $pendingDeployment = New-SafeScenario
    $pendingDeployment.Pages = @(
        (New-Page -Deployments @(@{ id = 'dpl-pending'; readyState = 'QUEUED' }) -Count 1 -Next $null)
    )
    Assert-RejectedWithoutMutation 'pending production deployment' $pendingDeployment -Execute

    $fullPageWithoutCursor = New-SafeScenario
    $fullPageWithoutCursor.Pages = @(
        (New-Page -Deployments @((1..100 | ForEach-Object { @{ id = ('dpl-{0}' -f $_); readyState = 'READY' } })) -Count 100 -Next $null)
    )
    Assert-RejectedWithoutMutation 'full page without continuation cursor' $fullPageWithoutCursor -Execute
}
finally {
    $ConfirmPreference = $savedConfirmPreference
}

Write-Output 'PowerShell syntax and entrypoint mock validation passed: read-only, WhatIf/decline, mismatch, exact approved stub mutation, active rollback, pagination and fail-closed response cases.'
