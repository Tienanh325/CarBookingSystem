param([Parameter(Mandatory=$true)][string]$InputFile, [switch]$ConfirmRestore)
if (-not $ConfirmRestore) { throw "Restore is destructive. Re-run with -ConfirmRestore." }
$resolved = (Resolve-Path -LiteralPath $InputFile).Path
if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required" }
$databaseUri = [Uri]$env:DATABASE_URL
$credentials = $databaseUri.UserInfo.Split(':', 2)
$dbUser = [Uri]::UnescapeDataString($credentials[0])
$dbPassword = if ($credentials.Length -gt 1) { [Uri]::UnescapeDataString($credentials[1]) } else { "" }
$dbName = $databaseUri.AbsolutePath.TrimStart('/')
$env:MYSQL_PWD = $dbPassword
try {
  Get-Content -Raw -LiteralPath $resolved | & mysql --host=$($databaseUri.Host) --port=$($databaseUri.Port) --user=$dbUser $dbName
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
if ($LASTEXITCODE -ne 0) { throw "mysql restore failed" }
Write-Output "Restore completed from $resolved"
