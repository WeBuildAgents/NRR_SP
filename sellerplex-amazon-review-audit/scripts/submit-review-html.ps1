[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$HtmlPath,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9]{10}$')]
    [string]$Asin,

    [Parameter(Mandatory = $true)]
    [ValidateSet(1, 2, 3)]
    [int]$Star,

    [Parameter(Mandatory = $true)]
    [ValidatePattern('^https://(www\.)?amazon\.com/')]
    [string]$SourceUrl,

    [ValidateRange(1, 10000)]
    [int]$PageNumber = 1,

    [ValidatePattern('^$|^\d{4}-\d{2}-\d{2}$')]
    [string]$SinceDate = '',

    [string]$SubmissionId = '',

    [string]$ClientId = '',

    [string]$BrandId = '',

    [string]$BrandName = '',

    [switch]$Notify,

    [string]$WebhookUrl = ''
)

$ErrorActionPreference = 'Stop'
$skillRoot = Split-Path -Parent $PSScriptRoot
$tokenPath = Join-Path $skillRoot 'secrets\workflow-token.txt'
$urlPath = Join-Path $skillRoot 'config\workflow-url.txt'

if (-not (Test-Path -LiteralPath $HtmlPath -PathType Leaf)) {
    throw "HTML file not found: $HtmlPath"
}

if (-not (Test-Path -LiteralPath $tokenPath -PathType Leaf)) {
    throw 'Workflow token is not provisioned. Ask a SellerPlex administrator.'
}

$token = (Get-Content -Raw -LiteralPath $tokenPath).Trim()
if ([string]::IsNullOrWhiteSpace($token) -or $token -match '^REPLACE_') {
    throw 'Workflow token is empty or still contains a placeholder.'
}

if ([string]::IsNullOrWhiteSpace($WebhookUrl)) {
    if (-not (Test-Path -LiteralPath $urlPath -PathType Leaf)) {
        throw 'Workflow URL configuration is missing.'
    }
    $WebhookUrl = (Get-Content -Raw -LiteralPath $urlPath).Trim()
}

$Asin = $Asin.ToUpperInvariant()
$expectedFilter = @{ 1 = 'one_star'; 2 = 'two_star'; 3 = 'three_star' }[$Star]
$sourceUri = [Uri]$SourceUrl
if (-not $sourceUri.AbsolutePath.ToUpperInvariant().Contains("/$Asin")) {
    throw 'SourceUrl does not contain the requested ASIN.'
}
if ($sourceUri.Query -notmatch "(?i)(?:^|[?&])filterByStar=$expectedFilter(?:&|$)") {
    throw "SourceUrl does not contain filterByStar=$expectedFilter."
}

$html = Get-Content -Raw -LiteralPath $HtmlPath
if ($html.Length -lt 5000) {
    throw 'HTML is too small to be a rendered Amazon review page.'
}
if ($html.Length -gt 8000000) {
    throw 'HTML exceeds the workflow 8 MB limit.'
}

if ([string]::IsNullOrWhiteSpace($SubmissionId)) {
    $SubmissionId = 'team-{0}-{1}' -f [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(), ([Guid]::NewGuid().ToString('N').Substring(0, 12))
}
if ($SubmissionId -notmatch '^[A-Za-z0-9._:-]{8,160}$') {
    throw 'SubmissionId must be 8-160 characters using letters, digits, dot, underscore, colon, or hyphen.'
}

$builder = [UriBuilder]$WebhookUrl
$query = [System.Web.HttpUtility]::ParseQueryString($builder.Query)
$query['asin'] = $Asin
$query['star_filter'] = [string]$Star
$query['source_url'] = $SourceUrl
$query['submission_id'] = $SubmissionId
$query['page_number'] = [string]$PageNumber
$query['notify'] = if ($Notify) { 'true' } else { 'false' }
if ($SinceDate) { $query['since_date'] = $SinceDate }
if ($ClientId) { $query['client_id'] = $ClientId }
if ($BrandId) { $query['brand_id'] = $BrandId }
if ($BrandName) { $query['brand_name'] = $BrandName }
$builder.Query = $query.ToString()

$headers = @{
    Authorization = "Bearer $token"
    Accept = 'application/json'
}
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($html)

try {
    $response = Invoke-RestMethod -Method Post -Uri $builder.Uri.AbsoluteUri -Headers $headers -ContentType 'text/html; charset=utf-8' -Body $bodyBytes
    $response | ConvertTo-Json -Depth 30
} catch {
    $statusCode = $null
    if ($_.Exception.Response) {
        $statusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($statusCode -eq 401) {
        throw 'Workflow authentication failed. Confirm that secrets\workflow-token.txt contains the current token.'
    }
    throw
}

