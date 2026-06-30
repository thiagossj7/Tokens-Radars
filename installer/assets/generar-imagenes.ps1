# Genera las imagenes BMP que usa el wizard de Inno Setup (WizardImageFile y
# WizardSmallImageFile) a partir de las imagenes fuente de la extension.
# Correrlo una sola vez (o de nuevo si cambian las imagenes fuente); los .bmp
# resultantes se commitean junto al resto de installer/assets/.
Add-Type -AssemblyName System.Drawing

$raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$origenVegeta = Join-Path $raiz 'extension\images\vegeta1.jpg'
$origenIcono  = Join-Path $raiz 'extension\images\icono.png'

# ---------- wizard-image.bmp: 164x314, banner de bienvenida ----------
$ancho = 164
$alto = 314
$lienzo = New-Object System.Drawing.Bitmap($ancho, $alto)
$g = [System.Drawing.Graphics]::FromImage($lienzo)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.Clear([System.Drawing.Color]::FromArgb(13, 13, 20))

$foto = [System.Drawing.Image]::FromFile($origenVegeta)
$escala = $ancho / $foto.Width
$altoFoto = [int]($foto.Height * $escala)
$g.DrawImage($foto, 0, 0, $ancho, $altoFoto)
$foto.Dispose()

$pincelDorado = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 215, 0))
$g.FillRectangle($pincelDorado, 0, $altoFoto, $ancho, 4)
$pincelDorado.Dispose()
$g.Dispose()

$lienzo.Save((Join-Path $PSScriptRoot 'wizard-image.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
$lienzo.Dispose()

# ---------- wizard-small.bmp: 55x58, icono de las paginas internas ----------
$anchoChico = 55
$altoChico = 58
$lienzoChico = New-Object System.Drawing.Bitmap($anchoChico, $altoChico)
$gc = [System.Drawing.Graphics]::FromImage($lienzoChico)
$gc.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gc.Clear([System.Drawing.Color]::White)

$icono = [System.Drawing.Image]::FromFile($origenIcono)
$tamanoIcono = 44
$xIcono = [int](($anchoChico - $tamanoIcono) / 2)
$yIcono = [int](($altoChico - $tamanoIcono) / 2)
$gc.DrawImage($icono, $xIcono, $yIcono, $tamanoIcono, $tamanoIcono)
$icono.Dispose()
$gc.Dispose()

$lienzoChico.Save((Join-Path $PSScriptRoot 'wizard-small.bmp'), [System.Drawing.Imaging.ImageFormat]::Bmp)
$lienzoChico.Dispose()

Write-Host "Generadas wizard-image.bmp (164x314) y wizard-small.bmp (55x58) en $PSScriptRoot"
