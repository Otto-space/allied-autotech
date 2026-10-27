[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [switch] $ExecuteRollback,
    [switch] $SelfTest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ExpectedDeploymentId = 'dpl_J5k6BjFUZVTFgeGJSrH4WHhiFxcq'
$script:ExpectedProjectName = 'allied-autotech'
$script:ExpectedProjectId = 'prj_LbuHFZ0EY8fBQL2pcOP1L3YHK2cb'
$script:ExpectedScope = 'michael-enochs-projects-3da06943'
$script:ExpectedCommit = 'fbb6565a57e484f802e1317d82f6631c55b34b03'
$script:MockScenario = $null
$script:MockMutationCount = 0

function Get-FieldValue {
    param(
        [Parameter(Mandatory = $true)] $Object,
        [Parameter(Mandatory = $true)] [string] $Name
    )

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $null
    }

    return $property.Value
}

function Invoke-VercelCli {
    param([Parameter(Mandatory = $true)] [string[]] $Arguments)

    if ($null -ne $script:MockScenario) {
        if ($Arguments[0] -eq 'rollback') {
            $script:MockMutationCount++
            throw 'The self-test mock must never receive a rollback command.'
        }

        if ($Arguments[0] -ne 'api' -or $Arguments.Count -lt 2) {
            throw 'Unexpected command in the rollback helper mock.'
        }

        $scopeIndex = [Array]::IndexOf($Arguments, '--scope')
        if ($scopeIndex -lt 0 -or
            $scopeIndex + 1 -ge $Arguments.Count -or
            $Arguments[$scopeIndex + 1] -cne $script:ExpectedScope) {
            throw 'The helper mock received an unexpected Vercel scope.'
        }

        $endpoint = $Arguments[1]
        if ($endpoint.StartsWith('/v9/projects/', [System.StringComparison]::Ordinal)) {
            $response = @{
                id = $script:MockScenario.ProjectId
                name = $script:MockScenario.ProjectName
            }
        }
        elseif ($endpoint.StartsWith('/v13/deployments/', [System.StringComparison]::Ordinal)) {
            $response = @{
                id = $script:MockScenario.DeploymentId
                name = $script:ExpectedProjectName
                projectId = $script:MockScenario.ProjectId
                target = 'production'
                readyState = $script:MockScenario.ReadyState
                gitSource = @{ sha = $script:MockScenario.Commit }
            }
        }
        elseif ($endpoint.StartsWith('/v7/deployments?', [System.StringComparison]::Ordinal)) {
            $response = @{ deployments = @($script:MockScenario.Deployments) }
        }
        else {
            throw 'Unexpected API endpoint in the rollback helper mock.'
        }

        return ConvertTo-Json -InputObject $response -Depth 8 -Compress
    }

    $vercel = Get-Command 'vercel' -ErrorAction SilentlyContinue
    if ($null -eq $vercel) {
        throw 'Vercel CLI was not found. Install/configure it separately, then retry.'
    }

    $output = @(& $vercel.Source @Arguments 2>$null)
    if ($LASTEXITCODE -ne 0) {
        if ($Arguments[0] -eq 'rollback') {
            throw 'The Vercel rollback command returned a non-zero exit code; its outcome is ambiguous. Check rollback status and aliases before retrying.'
        }
        throw 'A read-only Vercel CLI request failed. Check CLI authentication and project access without sharing credentials.'
    }

    return ($output -join [Environment]::NewLine)
}

function Invoke-VercelApi {
    param([Parameter(Mandatory = $true)] [string] $Endpoint)

    $raw = Invoke-VercelCli -Arguments @(
        'api',
        $Endpoint,
        '--scope',
        $script:ExpectedScope
    )

    try {
        return ConvertFrom-Json -InputObject $raw
    }
    catch {
        throw 'Vercel returned an unreadable API response. Refusing to continue.'
    }
}

function Assert-TargetIdentity {
    $project = Invoke-VercelApi -Endpoint (
        '/v9/projects/{0}?slug={1}' -f $script:ExpectedProjectId, $script:ExpectedScope
    )

    if ((Get-FieldValue $project 'id') -cne $script:ExpectedProjectId -or
        (Get-FieldValue $project 'name') -cne $script:ExpectedProjectName) {
        throw 'The Vercel project identity does not match the pinned project. Refusing to continue.'
    }

    $deployment = Invoke-VercelApi -Endpoint (
        '/v13/deployments/{0}?withGitRepoInfo=true&slug={1}' -f $script:ExpectedDeploymentId, $script:ExpectedScope
    )
    $gitSource = Get-FieldValue $deployment 'gitSource'

    if ((Get-FieldValue $deployment 'id') -cne $script:ExpectedDeploymentId -or
        (Get-FieldValue $deployment 'projectId') -cne $script:ExpectedProjectId -or
        (Get-FieldValue $deployment 'target') -cne 'production' -or
        (Get-FieldValue $deployment 'readyState') -cne 'READY' -or
        $null -eq $gitSource -or
        (Get-FieldValue $gitSource 'sha') -cne $script:ExpectedCommit) {
        throw 'The pinned deployment is missing, not production-ready, or has unexpected project/source metadata. Refusing to continue.'
    }
}

function Assert-NoPendingProductionDeployments {
    $result = Invoke-VercelApi -Endpoint (
        '/v7/deployments?projectId={0}&target=production&limit=20&slug={1}' -f
        $script:ExpectedProjectId, $script:ExpectedScope
    )
    $deployments = Get-FieldValue $result 'deployments'

    if ($null -eq $deployments -or @($deployments).Count -eq 0) {
        throw 'Vercel returned no production deployment list. Refusing to treat unknown state as safe.'
    }

    $pendingStates = @('BUILDING', 'INITIALIZING', 'QUEUED', 'BLOCKED')
    $terminalStates = @('READY', 'ERROR', 'CANCELED')
    foreach ($deployment in @($deployments)) {
        $state = Get-FieldValue $deployment 'readyState'
        if ([string]::IsNullOrWhiteSpace([string] $state)) {
            $state = Get-FieldValue $deployment 'state'
        }

        if ($pendingStates -contains [string] $state) {
            throw 'A production deployment is in progress. Stop and re-check after it reaches a terminal state.'
        }
        if ($terminalStates -notcontains [string] $state) {
            throw 'A production deployment has an unknown state. Refusing to continue.'
        }
    }

    return @($deployments).Count
}

function Assert-SafePreflight {
    Assert-TargetIdentity
    return Assert-NoPendingProductionDeployments
}

function Invoke-SelfTest {
    $passingScenario = @{
        ProjectId = $script:ExpectedProjectId
        ProjectName = $script:ExpectedProjectName
        DeploymentId = $script:ExpectedDeploymentId
        Commit = $script:ExpectedCommit
        ReadyState = 'READY'
        Deployments = @(@{ id = 'dpl-current'; readyState = 'READY' })
    }

    $script:MockScenario = $passingScenario
    $script:MockMutationCount = 0
    $count = Assert-SafePreflight
    if ($count -ne 1 -or $script:MockMutationCount -ne 0) {
        throw 'Self-test failed: safe dry-run must perform read-only checks and no rollback.'
    }

    $badScenarios = @(
        @{ label = 'wrong project ID'; change = { $script:MockScenario.ProjectId = 'prj_wrong' } },
        @{ label = 'wrong project name'; change = { $script:MockScenario.ProjectName = 'other-project' } },
        @{ label = 'wrong deployment ID'; change = { $script:MockScenario.DeploymentId = 'dpl_wrong' } },
        @{ label = 'wrong source commit'; change = { $script:MockScenario.Commit = '0' * 40 } },
        @{ label = 'unready target'; change = { $script:MockScenario.ReadyState = 'BUILDING' } },
        @{ label = 'pending production deployment'; change = { $script:MockScenario.Deployments = @(@{ id = 'dpl-pending'; readyState = 'QUEUED' }) } },
        @{ label = 'unknown production deployment state'; change = { $script:MockScenario.Deployments = @(@{ id = 'dpl-unknown'; readyState = 'UNKNOWN' }) } }
    )

    foreach ($case in $badScenarios) {
        $script:MockScenario = @{
            ProjectId = $passingScenario.ProjectId
            ProjectName = $passingScenario.ProjectName
            DeploymentId = $passingScenario.DeploymentId
            Commit = $passingScenario.Commit
            ReadyState = $passingScenario.ReadyState
            Deployments = @($passingScenario.Deployments)
        }
        & $case.change

        $rejected = $false
        try {
            Assert-SafePreflight | Out-Null
        }
        catch {
            $rejected = $true
        }
        if (-not $rejected) {
            throw ('Self-test failed: did not reject {0}.' -f $case.label)
        }
        if ($script:MockMutationCount -ne 0) {
            throw 'Self-test failed: a rejection path attempted a rollback.'
        }
    }

    $script:MockScenario = $null
    Write-Output 'Rollback helper self-test passed: safe dry-run and seven fail-closed cases; zero mutation calls.'
}

if ($SelfTest) {
    if ($ExecuteRollback -or $PSBoundParameters.ContainsKey('WhatIf')) {
        throw 'SelfTest cannot be combined with rollback or ShouldProcess options.'
    }
    Invoke-SelfTest
    return
}

if ($ExecuteRollback) {
    Write-Warning 'This helper can change production aliases. Verify the runbook, current incident, and owner approval before continuing.'
}

$deploymentCount = Assert-SafePreflight
Write-Output ('Preflight passed for production project {0} ({1}) in scope {2}.' -f
    $script:ExpectedProjectName, $script:ExpectedProjectId, $script:ExpectedScope)
Write-Output ('Pinned target: {0}; source commit: {1}; recent production deployments checked: {2}.' -f
    $script:ExpectedDeploymentId, $script:ExpectedCommit, $deploymentCount)

if (-not $ExecuteRollback) {
    Write-Output 'Read-only dry run only. No rollback or alias change was requested.'
    return
}

# Refresh immediately before requesting the user confirmation to reduce, not eliminate,
# the race window with an automatic or manually started production deployment.
$deploymentCount = Assert-SafePreflight
if (-not $PSCmdlet.ShouldProcess(
    ('production aliases for {0} in {1}' -f $script:ExpectedProjectName, $script:ExpectedScope),
    ('roll back to {0}' -f $script:ExpectedDeploymentId)
)) {
    return
}

$typedConfirmation = Read-Host ('Type the exact deployment ID {0} to continue' -f $script:ExpectedDeploymentId)
if ($typedConfirmation -cne $script:ExpectedDeploymentId) {
    throw 'Confirmation did not match the pinned deployment ID. No rollback was requested.'
}

# The only mutating CLI invocation in this helper. It uses the immutable target and scope.
$null = Invoke-VercelCli -Arguments @(
    'rollback',
    $script:ExpectedDeploymentId,
    '--scope',
    $script:ExpectedScope
)
Write-Warning 'Rollback request submitted. Independently verify Vercel rollback status, deployment identity, and public-route health; submission is not proof of recovery.'
