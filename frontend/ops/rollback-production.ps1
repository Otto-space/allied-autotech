[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [switch] $ExecuteRollback
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ExpectedDeploymentId = 'dpl_J5k6BjFUZVTFgeGJSrH4WHhiFxcq'
$script:ExpectedProjectName = 'allied-autotech'
$script:ExpectedProjectId = 'prj_LbuHFZ0EY8fBQL2pcOP1L3YHK2cb'
$script:ExpectedScope = 'michael-enochs-projects-3da06943'
$script:ExpectedCommit = 'fbb6565a57e484f802e1317d82f6631c55b34b03'
$script:DeploymentPageSize = 100
$script:MaximumDeploymentPages = 1000

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

    $vercel = Get-Command 'vercel' -ErrorAction SilentlyContinue
    if ($null -eq $vercel) {
        throw 'Vercel CLI was not found. Install/configure it separately, then retry.'
    }

    $isCommandFunction = $vercel.CommandType -eq [System.Management.Automation.CommandTypes]::Function -or
        $vercel.CommandType -eq [System.Management.Automation.CommandTypes]::Filter
    $output = @(& $vercel @Arguments 2>$null)
    if (-not $isCommandFunction -and $LASTEXITCODE -ne 0) {
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
    $pendingStates = @('BUILDING', 'INITIALIZING', 'QUEUED', 'BLOCKED')
    $terminalStates = @('READY', 'ERROR', 'CANCELED')

    $deploymentCount = 0
    $cursor = $null
    $seenCursors = @{}
    for ($pageNumber = 1; $pageNumber -le $script:MaximumDeploymentPages; $pageNumber++) {
        $endpoint = '/v7/deployments?projectId={0}&target=production&limit={1}&slug={2}' -f `
            $script:ExpectedProjectId, $script:DeploymentPageSize, $script:ExpectedScope
        if ($null -ne $cursor) {
            $endpoint = '{0}&until={1}' -f $endpoint, $cursor
        }

        $result = Invoke-VercelApi -Endpoint $endpoint
        $deploymentsProperty = $result.PSObject.Properties['deployments']
        $pagination = Get-FieldValue $result 'pagination'
        $paginationCountProperty = if ($null -eq $pagination) { $null } else { $pagination.PSObject.Properties['count'] }
        $paginationNextProperty = if ($null -eq $pagination) { $null } else { $pagination.PSObject.Properties['next'] }
        if ($null -eq $deploymentsProperty -or
            $deploymentsProperty.Value -isnot [System.Array] -or
            $null -eq $pagination -or
            $null -eq $paginationCountProperty -or
            $null -eq $paginationNextProperty) {
            throw 'Vercel returned a missing or malformed production deployment page. Refusing to continue.'
        }

        $deployments = $deploymentsProperty.Value
        $paginationCount = $paginationCountProperty.Value
        $parsedCount = 0
        if (-not [int]::TryParse([string] $paginationCount, [ref] $parsedCount) -or
            $parsedCount -ne $deployments.Count -or
            $parsedCount -lt 0 -or
            $parsedCount -gt $script:DeploymentPageSize) {
            throw 'Vercel returned inconsistent production deployment pagination metadata. Refusing to continue.'
        }

        if ($deployments.Count -eq 0) {
            throw 'Vercel returned an empty production deployment list/page. Refusing to treat unknown state as safe.'
        }

        foreach ($deployment in $deployments) {
            if ($null -eq $deployment) {
                throw 'Vercel returned an incomplete production deployment record. Refusing to continue.'
            }

            $state = Get-FieldValue $deployment 'readyState'
            if ([string]::IsNullOrWhiteSpace([string] $state)) {
                $state = Get-FieldValue $deployment 'state'
            }
            if ([string]::IsNullOrWhiteSpace([string] $state)) {
                throw 'A production deployment has no recognized state. Refusing to continue.'
            }

            if ($pendingStates -contains [string] $state) {
                throw 'A production deployment is in progress. Stop and re-check after it reaches a terminal state.'
            }
            if ($terminalStates -notcontains [string] $state) {
                throw 'A production deployment has an unknown state. Refusing to continue.'
            }
        }

        $deploymentCount += $deployments.Count
        $nextCursor = $paginationNextProperty.Value
        if ([string]::IsNullOrWhiteSpace([string] $nextCursor)) {
            if ($deployments.Count -eq $script:DeploymentPageSize) {
                throw 'Vercel returned a full production deployment page without a continuation cursor. Refusing to assume the list is complete.'
            }
            return $deploymentCount
        }

        $nextCursor = [string] $nextCursor
        if ($nextCursor -notmatch '^\d+$' -or $seenCursors.ContainsKey($nextCursor)) {
            throw 'Vercel returned an invalid or repeated production deployment cursor. Refusing to continue.'
        }
        $seenCursors[$nextCursor] = $true
        $cursor = $nextCursor
    }

    throw 'The production deployment list exceeded the helper pagination safety limit. Completeness is uncertain; refusing to continue.'
}

function Assert-NoActiveRollback {
    $output = Invoke-VercelCli -Arguments @(
        'rollback',
        'status',
        $script:ExpectedProjectName,
        '--scope',
        $script:ExpectedScope
    )
    $status = ($output -join [Environment]::NewLine).Trim()
    if ([string]::IsNullOrWhiteSpace($status)) {
        throw 'Vercel returned no rollback status. Refusing to treat unknown state as safe.'
    }

    if ($status -match '(?i)^\s*(?:(?:there\s+(?:are|is)\s+)?no|none|zero)\s+(?:pending|active|current)\s+rollbacks?(?:\s+(?:found|exist|available|to\s+show))?[.!]?\s*$' -or
        $status -match '(?i)^\s*(?:(?:there\s+(?:are|is)\s+)?no|none|zero)\s+rollbacks?\s+(?:are\s+)?(?:currently\s+)?(?:pending|active|in[\s_-]*progress)[.!]?\s*$') {
        return
    }
    if ($status -match '(?i)\b(pending|queued|initializing|building|in[\s_-]*progress|running|processing|active)\b') {
        throw 'Vercel reports an active or pending rollback. Stop and re-check after it reaches a terminal state.'
    }

    throw 'Vercel returned an unrecognized rollback status. Refusing to continue.'
}

function Assert-SafePreflight {
    Assert-TargetIdentity
    Assert-NoActiveRollback
    return Assert-NoPendingProductionDeployments
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
