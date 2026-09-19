param([switch]$Stop)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$localDir = Join-Path $projectRoot '.local/mysql'
$dataDir = Join-Path $localDir 'data'
$mysqlBin = 'C:/Program Files/MySQL/MySQL Server 8.0/bin'
$pidFile = Join-Path $localDir 'mysql.pid'
if ($Stop) {
  if (Test-Path $pidFile) {
    $mysqlProcess = Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue
    if ($mysqlProcess -and $mysqlProcess.Path -eq "$mysqlBin/mysqld.exe".Replace('/', '\')) { Stop-Process -Id $mysqlProcess.Id }
  }
  exit
}
if (-not (Test-Path "$mysqlBin/mysqld.exe")) { throw 'Install MySQL 8 or set mysqlBin to the installed binary directory.' }
New-Item -ItemType Directory -Force $localDir | Out-Null
$existing = Get-NetTCPConnection -State Listen -LocalPort 3307 -ErrorAction SilentlyContinue
if ($existing) { Write-Output 'Port 3307 already listening; no new server started.'; exit }
if (-not (Test-Path $dataDir)) {
  & "$mysqlBin/mysqld.exe" --no-defaults --initialize-insecure "--basedir=$($mysqlBin.Replace('/bin',''))" "--datadir=$dataDir" --console
  if ($LASTEXITCODE -ne 0) { throw 'MySQL initialization failed.' }
}
$argsList = @('--no-defaults', '--port=3307', '--bind-address=127.0.0.1', '--mysqlx=OFF', "--datadir=$dataDir", "--pid-file=$pidFile", "--log-error=$localDir/server.log")
$process = Start-Process -FilePath "$mysqlBin/mysqld.exe" -ArgumentList $argsList -WindowStyle Hidden -PassThru
Write-Output "Project MySQL starting on 127.0.0.1:3307 (PID $($process.Id))."
