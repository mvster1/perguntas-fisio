# compila o supa.exe com o compilador que estiver disponivel.
# use: .\build.ps1

$ErrorActionPreference = "Stop"
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$fonte = Join-Path $aqui "supa.c"
$saida = Join-Path $aqui "supa.exe"

$gcc = (Get-Command gcc -ErrorAction SilentlyContinue).Source
if (-not $gcc) {
    foreach ($p in @("C:\msys64\ucrt64\bin\gcc.exe", "C:\msys64\mingw64\bin\gcc.exe")) {
        if (Test-Path $p) { $gcc = $p; break }
    }
}

if ($gcc) {
    Write-Host "compilando com $gcc"
    & $gcc -O2 -o $saida $fonte -lwinhttp
    if ($LASTEXITCODE -eq 0) { Write-Host "pronto: $saida" }
    exit $LASTEXITCODE
}

$cl = (Get-Command cl -ErrorAction SilentlyContinue).Source
if ($cl) {
    Write-Host "compilando com cl"
    Push-Location $aqui
    & cl /nologo /O2 /Fe:supa.exe supa.c winhttp.lib
    $codigo = $LASTEXITCODE
    Remove-Item -ErrorAction SilentlyContinue supa.obj
    Pop-Location
    if ($codigo -eq 0) { Write-Host "pronto: $saida" }
    exit $codigo
}

Write-Host "nenhum compilador C encontrado."
Write-Host ""
Write-Host "instale um destes e rode de novo:"
Write-Host "  winget install -e --id BrechtSanders.WinLibs.POSIX.UCRT   # gcc avulso"
Write-Host "  C:\msys64\usr\bin\pacman.exe -S mingw-w64-ucrt-x86_64-gcc  # pelo msys2 ja instalado"
exit 1
