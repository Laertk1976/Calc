$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectDirectory = Split-Path -Parent $PSScriptRoot
$credentialPath = Join-Path $projectDirectory '.signing/calc-upload-credentials.xml'
$candidatePath = Join-Path $projectDirectory 'android/app/build/outputs/bundle/release/app-release.aab'
$unsignedPath = Join-Path $projectDirectory 'android/app/build/outputs/bundle/release/calc-1.2.2-unsigned.aab'
$signedPath = Join-Path $projectDirectory 'android/app/build/outputs/bundle/release/calc-1.2.2-play.aab'
$jdkBin = 'C:\Program Files\Java\jdk-21.0.11\bin'
$jarSigner = Join-Path $jdkBin 'jarsigner.exe'
$keyTool = Join-Path $jdkBin 'keytool.exe'

if (-not (Test-Path -LiteralPath $credentialPath -PathType Leaf)) { throw 'Local encrypted Play upload credentials were not found.' }
if (-not (Test-Path -LiteralPath $candidatePath -PathType Leaf)) { throw 'Release bundle candidate was not found. Build it first.' }
if (-not (Test-Path -LiteralPath $jarSigner -PathType Leaf)) { throw 'JDK jarsigner was not found.' }

$credentials = Import-Clixml -LiteralPath $credentialPath
$storePasswordPtr = [IntPtr]::Zero
$keyPasswordPtr = [IntPtr]::Zero
$archive = $null
$fileStream = $null
try {
    if (-not (Test-Path -LiteralPath $credentials.StoreFile -PathType Leaf)) { throw 'The upload keystore path in the local credentials file does not exist.' }

    $storePasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credentials.StorePassword)
    $keyPasswordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credentials.KeyPassword)
    $env:CALC_UPLOAD_STORE_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($storePasswordPtr)
    $env:CALC_UPLOAD_KEY_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($keyPasswordPtr)

    Remove-Item -LiteralPath $unsignedPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $signedPath -Force -ErrorAction SilentlyContinue
    $fileStream = [IO.File]::Open($unsignedPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    $archive = [IO.Compression.ZipArchive]::new($fileStream, [IO.Compression.ZipArchiveMode]::Create, $false)
    $inputArchive = [IO.Compression.ZipFile]::OpenRead($candidatePath)
    try {
        foreach ($entry in $inputArchive.Entries) {
            if ($entry.FullName -match '^META-INF/([^/]+\.(SF|RSA|DSA|EC)|MANIFEST\.MF|SIG-[^/]+)$') { continue }
            $outEntry = $archive.CreateEntry($entry.FullName, [IO.Compression.CompressionLevel]::Optimal)
            $inStream = $entry.Open()
            $outStream = $outEntry.Open()
            try { $inStream.CopyTo($outStream) } finally { $outStream.Dispose(); $inStream.Dispose() }
        }
    } finally { $inputArchive.Dispose() }
    $archive.Dispose(); $archive = $null
    $fileStream.Dispose(); $fileStream = $null

    & $jarSigner -keystore $credentials.StoreFile '-storepass:env' CALC_UPLOAD_STORE_PASSWORD '-keypass:env' CALC_UPLOAD_KEY_PASSWORD -digestalg SHA-256 -sigalg SHA256withRSA -signedjar $signedPath $unsignedPath $credentials.KeyAlias
    if ($LASTEXITCODE -ne 0) { throw 'Signing the Play bundle failed.' }

    $verification = & $jarSigner -verify -verbose -certs $signedPath 2>&1
    $verificationExitCode = $LASTEXITCODE
    $verificationText = $verification | Out-String
    if ($verificationExitCode -ne 0 -or $verificationText -notmatch 'Calc Upload') {
        throw 'The signed bundle did not verify with the expected Play upload certificate.'
    }

    $signedFile = Get-Item -LiteralPath $signedPath
    Write-Output "Signed Play bundle: $($signedFile.FullName)"
    Write-Output "Size: $([Math]::Round($signedFile.Length / 1MB, 1)) MB"
} finally {
    if ($archive) { $archive.Dispose() }
    if ($fileStream) { $fileStream.Dispose() }
    Remove-Item Env:\CALC_UPLOAD_STORE_PASSWORD,Env:\CALC_UPLOAD_KEY_PASSWORD -ErrorAction SilentlyContinue
    if ($storePasswordPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($storePasswordPtr) }
    if ($keyPasswordPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($keyPasswordPtr) }
}
