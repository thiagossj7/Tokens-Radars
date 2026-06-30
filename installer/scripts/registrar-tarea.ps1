# Registra la tarea programada de arranque oculto (la versión gráfica de lo que
# hoy hace instalar.ps1). Escribe "1"/"0" en $ArchivoSalida segun el resultado.
param(
    [Parameter(Mandatory=$true)][string]$NombreTarea,
    [Parameter(Mandatory=$true)][string]$RutaVbs,
    [Parameter(Mandatory=$true)][string]$CarpetaServidor,
    [Parameter(Mandatory=$true)][string]$ArchivoSalida
)
try {
    $accion   = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$RutaVbs`"" -WorkingDirectory $CarpetaServidor
    $trigger  = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    Register-ScheduledTask -TaskName $NombreTarea -Action $accion -Trigger $trigger -Settings $settings -Force | Out-Null
    [System.IO.File]::WriteAllText($ArchivoSalida, "1")
} catch {
    [System.IO.File]::WriteAllText($ArchivoSalida, "0")
}
