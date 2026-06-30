# Llama a /usage y escribe "OK|sesion|semana" o "ERROR|mensaje" en $ArchivoSalida.
# Lo invoca el instalador de forma oculta para mostrar el % de uso en la pantalla de Fin.
param(
    [Parameter(Mandatory=$true)][string]$ArchivoSalida,
    [int]$Puerto = 37123
)
try {
    $r = Invoke-RestMethod -Uri "http://localhost:$Puerto/usage" -TimeoutSec 5
    if ($r.error) {
        [System.IO.File]::WriteAllText($ArchivoSalida, "ERROR|$($r.error)")
    } else {
        $sesion = [math]::Round($r.session.utilization * 100, 1)
        $semana = [math]::Round($r.week.utilization * 100, 1)
        [System.IO.File]::WriteAllText($ArchivoSalida, "OK|$sesion|$semana")
    }
} catch {
    [System.IO.File]::WriteAllText($ArchivoSalida, "ERROR|sin respuesta")
}
