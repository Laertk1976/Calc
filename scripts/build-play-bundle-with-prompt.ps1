$ErrorActionPreference = 'Stop'

$projectDirectory = Split-Path -Parent $PSScriptRoot
$keytool = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr\bin\keytool.exe'
$storeFile = Join-Path $projectDirectory '.signing\calc-upload-reset.jks'
$certificateFile = Join-Path $projectDirectory '.signing\calc-upload-reset-certificate.pem'
$bundleFile = Join-Path $projectDirectory 'android\app\build\outputs\bundle\release\app-release.aab'
$keyAlias = 'calc-upload-reset'

foreach ($path in @($keytool, $storeFile, $certificateFile)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required signing file was not found: $path"
    }
}

function Set-EnvironmentSecret([string]$name, [Security.SecureString]$value) {
    $pointer = [IntPtr]::Zero
    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($value)
        [Environment]::SetEnvironmentVariable($name, [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer), 'Process')
    } finally {
        if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    }
}

$storePassword = Read-Host 'Enter keystore password' -AsSecureString
$keyPassword = Read-Host 'Enter key password (press Enter if it is the same)' -AsSecureString
if ($keyPassword.Length -eq 0) { $keyPassword = $storePassword }

$oldGradleHome = $env:GRADLE_USER_HOME
$oldNodeEnv = $env:NODE_ENV
$oldPath = $env:PATH
$startedAt = Get-Date
try {
    $env:CALC_UPLOAD_STORE_FILE = $storeFile
    $env:CALC_UPLOAD_KEY_ALIAS = $keyAlias
    Set-EnvironmentSecret 'CALC_UPLOAD_STORE_PASSWORD' $storePassword
    Set-EnvironmentSecret 'CALC_UPLOAD_KEY_PASSWORD' $keyPassword
    $env:GRADLE_USER_HOME = Join-Path $projectDirectory '.g'
    $env:NODE_ENV = 'production'
    $env:PATH = (Join-Path $env:ProgramFiles 'Android\Android Studio\jbr\bin') + ';' + (Join-Path $env:ProgramFiles 'nodejs') + ';' + $oldPath

    # Windows PowerShell 5.1 treats native stderr (including keytool's JKS
    # format warning) as an error record when ErrorActionPreference is Stop.
    # Capture it while checking keytool's actual process exit code.
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $keyValidationOutput = & $keytool -list -keystore $storeFile -alias $keyAlias '-storepass:env' CALC_UPLOAD_STORE_PASSWORD 2>&1
        $keyValidationExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($keyValidationExitCode -ne 0) { throw 'The keystore password or alias did not validate. Check the password and alias, then run the script again.' }

    Push-Location (Join-Path $projectDirectory 'android')
    try {
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & .\gradlew.bat app:bundleRelease -PplayStoreRelease=true --console=plain --no-daemon
            $buildExitCode = $LASTEXITCODE
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        if ($buildExitCode -ne 0) { throw 'Play bundle build failed.' }
    } finally {
        Pop-Location
    }

    if (-not (Test-Path -LiteralPath $bundleFile -PathType Leaf)) { throw 'Gradle did not create the release AAB.' }
    if ((Get-Item -LiteralPath $bundleFile).LastWriteTime -lt $startedAt) { throw 'The release AAB was not updated by this build.' }

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $bundleCertificateLines = & $keytool -printcert -jarfile $bundleFile 2>&1
        $bundleCertificateExitCode = $LASTEXITCODE
        $expectedCertificateLines = & $keytool -printcert -file $certificateFile 2>&1
        $expectedCertificateExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($bundleCertificateExitCode -ne 0) { throw 'Could not inspect the AAB signing certificate.' }
    if ($expectedCertificateExitCode -ne 0) { throw 'Could not inspect the registered upload certificate.' }
    $bundleCertificate = $bundleCertificateLines | Out-String
    $expectedCertificate = $expectedCertificateLines | Out-String
    $bundleFingerprint = [regex]::Match($bundleCertificate, '(?m)^\s*SHA256:\s*([0-9A-F:]+)\s*$').Groups[1].Value.Replace(':', '').ToUpperInvariant()
    $expectedFingerprint = [regex]::Match($expectedCertificate, '(?m)^\s*SHA256:\s*([0-9A-F:]+)\s*$').Groups[1].Value.Replace(':', '').ToUpperInvariant()
    if (-not $bundleFingerprint -or $bundleFingerprint -ne $expectedFingerprint) {
        throw 'The AAB signer does not match the upload certificate registered in Play Console.'
    }

    $bundle = Get-Item -LiteralPath $bundleFile
    Write-Output "Verified Play AAB: $($bundle.FullName)"
    Write-Output "Version: 1.3.0 (43); size: $([Math]::Round($bundle.Length / 1MB, 1)) MB"
    Write-Output 'The AAB signing certificate matches the registered upload key.'
} finally {
    foreach ($name in @('CALC_UPLOAD_STORE_FILE', 'CALC_UPLOAD_STORE_PASSWORD', 'CALC_UPLOAD_KEY_ALIAS', 'CALC_UPLOAD_KEY_PASSWORD')) {
        [Environment]::SetEnvironmentVariable($name, $null, 'Process')
    }
    $env:GRADLE_USER_HOME = $oldGradleHome
    $env:NODE_ENV = $oldNodeEnv
    $env:PATH = $oldPath
    $storePassword = $null
    $keyPassword = $null
}
