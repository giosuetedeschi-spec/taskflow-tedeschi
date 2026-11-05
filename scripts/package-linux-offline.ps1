param(
  [string]$BuildId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$bunVersion = (& bun --version).Trim()
if ($bunVersion -ne '1.4.2') { throw "Expected Bun 1.4.2, found $bunVersion." }

$previousNodeEnv = $env:NODE_ENV
try {
  $env:NODE_ENV = 'production'
  & bun run build
  if ($LASTEXITCODE -ne 0) { throw "Production build exited with code $LASTEXITCODE" }
} finally {
  if ($null -eq $previousNodeEnv) { Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue }
  else { $env:NODE_ENV = $previousNodeEnv }
}

$distRoot = Join-Path $repoRoot 'dist'
$cacheRoot = Join-Path $distRoot 'offline-cache'
$runtimeZip = Join-Path $cacheRoot 'bun-linux-x64-baseline.zip'
$runtimeHash = 'c678040f14fe0440eb839d37cbd0ce4c051a32da72806ac97de6a6aab6bf728f'
$stageRoot = Join-Path $distRoot "offline-package-$BuildId"
$bundleRoot = Join-Path $stageRoot 'taskflow'
$runtimeExtract = Join-Path $stageRoot 'runtime-extract'
$artifactBase = "taskflow-ct138-linux-x64-baseline-$BuildId"
$archivePath = Join-Path $distRoot "$artifactBase.tar.gz"
$archiveHashPath = "$archivePath.sha256"

foreach ($path in @($stageRoot, $archivePath, $archiveHashPath)) {
  if (Test-Path -LiteralPath $path) { throw "Refusing to overwrite existing path: $path" }
}
foreach ($path in @('apps/api/dist/server.js', 'apps/api/migrations/001-initial.sql', 'apps/api/migrations/002-token-version.sql', 'apps/web/dist/index.html')) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $path) -PathType Leaf)) { throw "Missing build input: $path. Run bun run build first." }
}

New-Item -ItemType Directory -Path $cacheRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $runtimeZip)) {
  Invoke-WebRequest -Uri 'https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-linux-x64-baseline.zip' -OutFile $runtimeZip
}
$actualRuntimeHash = (Get-FileHash -LiteralPath $runtimeZip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualRuntimeHash -ne $runtimeHash) { throw "Bun runtime archive checksum mismatch: $actualRuntimeHash" }

New-Item -ItemType Directory -Path $stageRoot,$bundleRoot,$runtimeExtract | Out-Null
Expand-Archive -LiteralPath $runtimeZip -DestinationPath $runtimeExtract
New-Item -ItemType Directory -Path (Join-Path $bundleRoot 'runtime'),(Join-Path $bundleRoot 'apps/api'),(Join-Path $bundleRoot 'apps/web'),(Join-Path $bundleRoot 'systemd'),(Join-Path $bundleRoot 'deployment') | Out-Null
Copy-Item -LiteralPath (Join-Path $runtimeExtract 'bun-linux-x64-baseline/bun') -Destination (Join-Path $bundleRoot 'runtime/bun')
Copy-Item -LiteralPath (Join-Path $repoRoot 'apps/api/dist') -Destination (Join-Path $bundleRoot 'apps/api') -Recurse
Copy-Item -LiteralPath (Join-Path $repoRoot 'apps/api/migrations') -Destination (Join-Path $bundleRoot 'apps/api') -Recurse
Copy-Item -LiteralPath (Join-Path $repoRoot 'apps/web/dist') -Destination (Join-Path $bundleRoot 'apps/web') -Recurse
Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy/offline/taskflow.service') -Destination (Join-Path $bundleRoot 'systemd/taskflow.service')
Copy-Item -LiteralPath (Join-Path $repoRoot 'deploy/offline/taskflow.env.example') -Destination (Join-Path $bundleRoot 'deployment/taskflow.env.example')
Copy-Item -LiteralPath (Join-Path $repoRoot 'docs/deployment-ct138.md') -Destination (Join-Path $bundleRoot 'deployment/README.md')

$apiPackage = Get-Content -LiteralPath (Join-Path $repoRoot 'apps/api/package.json') -Raw | ConvertFrom-Json
$webPackage = Get-Content -LiteralPath (Join-Path $repoRoot 'apps/web/package.json') -Raw | ConvertFrom-Json
$gitRevision = (& git -C $repoRoot rev-parse HEAD 2>$null)
$gitStatus = (& git -C $repoRoot status --porcelain 2>$null)
$buildInfo = [ordered]@{
  buildId = $BuildId
  builtAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  sourceRevision = $(if ($gitRevision) { $gitRevision.Trim() } else { 'working-tree' })
  sourceTreeDirty = [bool]$gitStatus
  bunVersion = $bunVersion
  target = 'linux-x64-baseline (Debian 13, glibc)'
  runtimeArchiveSha256 = $runtimeHash
  runtimeDependencies = 'API JavaScript workspace dependencies are bundled into apps/api/dist/server.js; browser dependencies are compiled into apps/web/dist/assets. No package installation is required on the target.'
}
$dependencyInventory = [ordered]@{
  api = $apiPackage.dependencies
  web = $webPackage.dependencies
  runtimeBundling = 'Bun single-file API build and Vite static build; no node_modules on target.'
}
$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText((Join-Path $bundleRoot 'BUILD-INFO.json'), ($buildInfo | ConvertTo-Json -Depth 8) + "`n", $utf8NoBom)
[IO.File]::WriteAllText((Join-Path $bundleRoot 'DEPENDENCIES.json'), ($dependencyInventory | ConvertTo-Json -Depth 8) + "`n", $utf8NoBom)

$manifestPath = Join-Path $bundleRoot 'SHA256SUMS'
$manifestLines = Get-ChildItem -LiteralPath $bundleRoot -File -Recurse |
  Where-Object { $_.FullName -ne $manifestPath } |
  Sort-Object { $_.FullName.Substring($bundleRoot.Length + 1).Replace([string][char]92,'/') } |
  ForEach-Object {
    $relative = $_.FullName.Substring($bundleRoot.Length + 1).Replace([string][char]92,'/')
    $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    "$hash  $relative"
  }
[IO.File]::WriteAllText($manifestPath, ($manifestLines -join "`n") + "`n", $utf8NoBom)

& tar.exe -czf $archivePath -C $stageRoot 'taskflow'
if ($LASTEXITCODE -ne 0) { throw "tar exited with code $LASTEXITCODE" }
$archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText($archiveHashPath, "$archiveHash  $([IO.Path]::GetFileName($archivePath))`n", $utf8NoBom)
Write-Output "Artifact: $archivePath"
Write-Output "Archive SHA256: $archiveHash"
Write-Output "Bundle manifest: $(Join-Path $bundleRoot 'SHA256SUMS')"
