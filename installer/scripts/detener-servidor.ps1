# Detiene el proceso que esta escuchando en el puerto del Radar de Tokens (si hay
# alguno). Lo usa el desinstalador; identifica el proceso por el puerto, no por
# nombre, para no matar otros procesos node.exe que el usuario pueda tener corriendo.
param(
    [int]$Puerto = 37123
)
try {
    $conexion = Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($conexion) {
        Stop-Process -Id $conexion.OwningProcess -Force -ErrorAction SilentlyContinue
    }
} catch {}
