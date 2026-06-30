# Descarga el node.exe portable oficial a $Destino. Escribe "1" en "$Destino.ok" si
# salio bien, "0" si fallo. Lo invoca el instalador de forma oculta.
param(
    [Parameter(Mandatory=$true)][string]$Destino,
    [Parameter(Mandatory=$true)][string]$Url
)
try {
    Invoke-WebRequest -Uri $Url -OutFile $Destino -UseBasicParsing
    [System.IO.File]::WriteAllText("$Destino.ok", "1")
} catch {
    [System.IO.File]::WriteAllText("$Destino.ok", "0")
}
