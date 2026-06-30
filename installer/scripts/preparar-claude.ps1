# Si faltan credenciales de Claude: instala Claude Code si hace falta y lanza el
# login, todo oculto (sin ventanas). Escribe el resultado en $ArchivoSalida:
#   "YA-TIENE-CREDENCIALES" | "LOGIN-LANZADO" | "ERROR|mensaje"
param(
    [Parameter(Mandatory=$true)][string]$ArchivoSalida
)
$cred1 = Join-Path $env:USERPROFILE '.claude\.credentials.json'
$cred2 = Join-Path $env:USERPROFILE '.config\claude\.credentials.json'
if ((Test-Path $cred1) -or (Test-Path $cred2)) {
    [System.IO.File]::WriteAllText($ArchivoSalida, "YA-TIENE-CREDENCIALES")
    exit
}

$claude = $null
try { $claude = (Get-Command claude -ErrorAction Stop).Source } catch {}
if (-not $claude) {
    try {
        Invoke-RestMethod -Uri 'https://claude.ai/install.ps1' -UseBasicParsing | Invoke-Expression
    } catch {
        [System.IO.File]::WriteAllText($ArchivoSalida, "ERROR|No se pudo instalar Claude Code")
        exit
    }
    $rutasPosibles = @(
        (Join-Path $env:USERPROFILE '.local\bin\claude.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\claude\claude.exe')
    )
    foreach ($r in $rutasPosibles) { if (Test-Path $r) { $claude = $r; break } }
    if (-not $claude) {
        try { $claude = (Get-Command claude -ErrorAction Stop).Source } catch {}
    }
}
if (-not $claude) {
    [System.IO.File]::WriteAllText($ArchivoSalida, "ERROR|No se encontro claude.exe tras instalar")
    exit
}

Start-Process -FilePath $claude -WindowStyle Hidden
[System.IO.File]::WriteAllText($ArchivoSalida, "LOGIN-LANZADO")
