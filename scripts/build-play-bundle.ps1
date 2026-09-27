$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
$requiredVariables = @('CALC_UPLOAD_STORE_FILE', 'CALC_UPLOAD_STORE_PASSWORD', 'CALC_UPLOAD_KEY_ALIAS', 'CALC_UPLOAD_KEY_PASSWORD')
foreach ($variableName in $requiredVariables) {
    if (-not [Environment]::GetEnvironmentVariable($variableName)) {
        throw "Missing $variableName. See release/PLAY_STORE.md."
    }
}
if (-not [IO.Path]::IsPathRooted($env:CALC_UPLOAD_STORE_FILE) -or -not (Test-Path -LiteralPath $env:CALC_UPLOAD_STORE_FILE -PathType Leaf)) {
    throw 'CALC_UPLOAD_STORE_FILE must be an absolute path to an existing keystore.'
}
$env:NODE_ENV = 'production'
Push-Location (Join-Path $projectDirectory 'android')
try {
    & .\gradlew.bat app:bundleRelease -PplayStoreRelease=true --console=plain --no-daemon
    if ($LASTEXITCODE -ne 0) { throw 'Play bundle build failed.' }
    Write-Output 'Bundle built: android/app/build/outputs/bundle/release/app-release.aab'
    Write-Output 'Complete release/PLAY_STORE.md before uploading.'
} finally {
    Pop-Location
}
