# Instalador del Radar de Tokens — Vegeta
# Deja todo el lado del servidor funcionando aunque el PC no tenga Node ni Claude Code:
#   1. Busca Node; si no hay, descarga un node.exe portable (oficial, sin admin) en server/
#   2. Verifica las credenciales de Claude; si faltan, instala Claude Code y espera el login
#   3. Registra la tarea programada "RadarDeTokens" (arranque oculto al iniciar sesión)
#   4. Arranca el servidor ya mismo y verifica que responde
# Al usuario solo le queda cargar la extensión en Chrome.

$ErrorActionPreference = 'Stop'
$raiz   = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = Join-Path $raiz 'server'

Write-Host ""
Write-Host "=== Radar de Tokens (Vegeta) - Instalador ===" -ForegroundColor Cyan
Write-Host ""

# ---------- Paso 1: Node.js ----------
$nodeLocal = Join-Path $server 'node.exe'
$node = $null
try { $node = (Get-Command node -ErrorAction Stop).Source } catch {}
if (-not $node -and (Test-Path $nodeLocal)) { $node = $nodeLocal }

if (-not $node) {
    Write-Host "[1/4] Node.js no encontrado. Descargando version portable oficial (~83 MB, sin instalar nada en el sistema)..."
    Invoke-WebRequest -Uri 'https://nodejs.org/dist/latest-v22.x/win-x64/node.exe' -OutFile $nodeLocal -UseBasicParsing
    $node = $nodeLocal
    Write-Host "      Descargado en server\node.exe" -ForegroundColor Green
} else {
    Write-Host "[1/4] Node.js encontrado: $node" -ForegroundColor Green
}

# ---------- Paso 2: Credenciales de Claude ----------
$cred1 = Join-Path $env:USERPROFILE '.claude\.credentials.json'
$cred2 = Join-Path $env:USERPROFILE '.config\claude\.credentials.json'
$hayCredenciales = (Test-Path $cred1) -or (Test-Path $cred2)

if ($hayCredenciales) {
    Write-Host "[2/4] Credenciales de Claude encontradas." -ForegroundColor Green
} else {
    $claude = $null
    try { $claude = (Get-Command claude -ErrorAction Stop).Source } catch {}
    if (-not $claude) {
        Write-Host "[2/4] Claude Code no esta instalado. Instalando con el instalador oficial de Anthropic..."
        Invoke-RestMethod -Uri 'https://claude.ai/install.ps1' -UseBasicParsing | Invoke-Expression
        # El instalador agrega claude al PATH de futuras sesiones; localizarlo ahora
        $rutasPosibles = @(
            (Join-Path $env:USERPROFILE '.local\bin\claude.exe'),
            (Join-Path $env:LOCALAPPDATA 'Programs\claude\claude.exe')
        )
        foreach ($r in $rutasPosibles) { if (Test-Path $r) { $claude = $r; break } }
        if (-not $claude) { try { $claude = (Get-Command claude -ErrorAction Stop).Source } catch {} }
        if (-not $claude) {
            Write-Host "      No se pudo localizar claude.exe tras la instalacion." -ForegroundColor Red
            Write-Host "      Cierra esta ventana, abre una terminal nueva, corre 'claude' para iniciar sesion y vuelve a ejecutar instalar.bat."
            exit 1
        }
    }
    Write-Host "      Se abrira una ventana de Claude. Sigue el proceso de inicio de sesion (se abrira el navegador)."
    Write-Host "      Cuando termines el login puedes cerrar esa ventana."
    Start-Process cmd -ArgumentList '/k', "`"$claude`""
    Write-Host "      Esperando a que inicies sesion en Claude..." -NoNewline
    while (-not (Test-Path $cred1) -and -not (Test-Path $cred2)) {
        Start-Sleep -Seconds 3
        Write-Host "." -NoNewline
    }
    Write-Host ""
    Write-Host "      Sesion de Claude detectada." -ForegroundColor Green
}

# ---------- Paso 3: Tarea programada (arranque oculto) ----------
Write-Host "[3/4] Registrando arranque automatico invisible (tarea RadarDeTokens)..."
$vbs      = Join-Path $server 'start-hidden.vbs'
$accion   = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`"" -WorkingDirectory $server
$trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'RadarDeTokens' -Action $accion -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "      Tarea registrada." -ForegroundColor Green

# ---------- Paso 4: Arrancar y verificar ----------
Write-Host "[4/4] Arrancando el servidor..."
Start-ScheduledTask -TaskName 'RadarDeTokens'
$ok = $false
foreach ($i in 1..10) {
    Start-Sleep -Seconds 1
    try {
        $r = Invoke-RestMethod -Uri 'http://localhost:37123/usage' -TimeoutSec 5
        $ok = $true; break
    } catch {}
}

Write-Host ""
if ($ok) {
    if ($r.error) {
        Write-Host "El servidor responde pero reporta: $($r.error)" -ForegroundColor Yellow
    } else {
        $pctSesion = [math]::Round($r.session.utilization * 100, 1)
        $pctSemana = [math]::Round($r.week.utilization * 100, 1)
        Write-Host "Todo listo. Uso actual - Sesion: $pctSesion% | Semana: $pctSemana%" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "ULTIMO PASO (manual): cargar la extension en Chrome" -ForegroundColor Cyan
    Write-Host "  1. Abre chrome://extensions"
    Write-Host "  2. Activa 'Modo de desarrollador' (esquina superior derecha)"
    Write-Host "  3. Pulsa 'Cargar descomprimida' y selecciona la carpeta:"
    Write-Host "     $raiz\extension"
} else {
    Write-Host "El servidor no respondio en http://localhost:37123/usage" -ForegroundColor Red
    Write-Host "Prueba a correrlo a mano para ver el error: cd `"$server`"; node server.js"
}
Write-Host ""
