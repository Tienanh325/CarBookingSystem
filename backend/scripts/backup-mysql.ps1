param([Parameter(Mandatory=$true)][string]$OutputFile)
$resolved = [System.IO.Path]::GetFullPath($OutputFile)
$directory = Split-Path -Parent $resolved
if (-not (Test-Path -LiteralPath $directory)) { New-Item -ItemType Directory -Path $directory | Out-Null }
if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required" }
$databaseUri = [Uri]$env:DATABASE_URL
$credentials = $databaseUri.UserInfo.Split(':', 2)
$dbUser = [Uri]::UnescapeDataString($credentials[0])
$dbPassword = if ($credentials.Length -gt 1) { [Uri]::UnescapeDataString($credentials[1]) } else { "" }
$dbName = $databaseUri.AbsolutePath.TrimStart('/')
$env:MYSQL_PWD = $dbPassword
try {
  & mysqldump --host=$($databaseUri.Host) --port=$($databaseUri.Port) --user=$dbUser --single-transaction --routines --events --result-file=$resolved $dbName
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}
if ($LASTEXITCODE -ne 0) { throw "mysqldump failed" }
Write-Output "Backup written to $resolved"
