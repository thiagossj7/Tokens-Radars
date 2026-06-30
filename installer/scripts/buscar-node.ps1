# Busca node en el PATH del sistema y escribe la ruta (o vacio si no esta) en $ArchivoSalida.
# Lo invoca el instalador (Pascal Script) de forma oculta, sin abrir ninguna consola.
param(
    [Parameter(Mandatory=$true)][string]$ArchivoSalida
)
try {
    $ruta = (Get-Command node -ErrorAction Stop).Source
} catch {
    $ruta = ''
}
[System.IO.File]::WriteAllText($ArchivoSalida, $ruta)
