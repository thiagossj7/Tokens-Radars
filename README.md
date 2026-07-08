# Radar de Tokens â€” Vegeta

ExtensiÃ³n de Google Chrome que muestra tu uso del plan de Claude en tiempo real con Vegeta vigilando.

Dos barras de progreso: **SesiÃ³n (ventana de 5 horas)** y **Semanal (ventana de 7 dÃ­as)**. El dato refleja todo tu consumo del plan â€” web, app y Claude Code â€” porque se lee directamente desde las cabeceras de la API de Anthropic con tu token OAuth.

---

## CÃ³mo funciona

El proyecto tiene dos piezas:

1. **Servidor local** (`server/`) â€” Node.js + Express corriendo en `localhost:37123`. Lee tu token OAuth guardado por Claude Code y hace una peticiÃ³n mÃ­nima a `api.anthropic.com` para extraer las cabeceras de uso. El token **nunca** sale de tu mÃ¡quina ni llega a la extensiÃ³n.

2. **ExtensiÃ³n Chrome** (`extension/`) â€” solo consume `http://localhost:37123/usage` y pinta las barras. No tiene acceso a credenciales.

---

## Requisitos

- **Google Chrome**
- **Una cuenta de Claude** (plan Pro/Max) â€” la extensiÃ³n muestra el uso de *tu* plan

No hace falta tener Node.js ni Claude Code instalados: el instalador se encarga de ambos.

---

## InstalaciÃ³n (un clic)

### Paso 1 â€” Ejecutar el instalador

Haz **doble clic en `RadarDeTokens-Setup.exe`** (en la raÃ­z del proyecto). Es un instalador grÃ¡fico nativo (sin ninguna ventana de consola en ningÃºn momento) que:

1. Copia el servidor y la extensiÃ³n a `%LocalAppData%\RadarDeTokens\`.
2. Busca Node.js; si no estÃ¡, **descarga un `node.exe` portable oficial** (~83 MB) â€” sin permisos de administrador y sin instalar nada mÃ¡s en el sistema.
3. Busca tus credenciales de Claude; si faltan, instala Claude Code y espera tu login en el navegador (la pantalla de progreso avanza sola en cuanto detecta la sesiÃ³n).
4. Registra el **arranque automÃ¡tico invisible**: el servidor se inicia solo en cada inicio de sesiÃ³n de Windows, sin ninguna ventana.
5. Arranca el servidor de inmediato y muestra tu % de uso actual en la pantalla final.

El servidor no tiene dependencias (`npm install` ya no existe en este proyecto): es un Ãºnico `server.js` que solo usa mÃ³dulos nativos de Node.

### Paso 2 â€” Cargar la extensiÃ³n en Chrome

1. Abre `chrome://extensions`
2. Activa **"Modo de desarrollador"** (interruptor en la esquina superior derecha)
3. Pulsa **"Cargar descomprimida"**
4. Selecciona la carpeta `extension/` dentro de `%LocalAppData%\RadarDeTokens\` (la pantalla final del instalador tiene un botÃ³n para abrirla directo)

El icono del radar aparecerÃ¡ en la barra de Chrome. PÃºlsalo para ver tus barras de uso.

### Alternativa manual (sin instalador)

Si preferÃ­s no usar `RadarDeTokens-Setup.exe`: con Node instalado, corre `cd server && npm start` desde una copia del repo y deja la ventana abierta (el bloque de PowerShell de la secciÃ³n de arranque automÃ¡tico registra la versiÃ³n invisible).

---

## Uso diario

- **Al abrir el popup** se muestra el Ãºltimo dato disponible (puede venir de la cachÃ© del servidor, sin gastar cupo).
- **BotÃ³n â†» Actualizar** â€” fuerza una lectura nueva contra la API. Ãšsalo cuando quieras el dato mÃ¡s reciente; cada pulsaciÃ³n hace una peticiÃ³n mÃ­nima (Haiku, 1 token) que gasta una pizca de tu plan.
- La barra con borde dorado es la que actualmente te estÃ¡ limitando (`representative claim`).
- Si una barra supera el 100 %, se muestra en rojo con el sÃ­mbolo âš .

---

## ExtensiÃ³n VS Code â€” Claude Sayayin Token Radar

AdemÃ¡s de la extensiÃ³n Chrome, el radar tambiÃ©n funciona directamente en **VS Code** con una extensiÃ³n que muestra el consumo en la barra de estado.

![icono](vscode-radar/assets/icono-128.png)

### CÃ³mo funciona

La extensiÃ³n lee el token OAuth de Claude Code directamente desde el archivo de credenciales local y consulta la API de Anthropic por su cuenta.

- **Status bar**: `S:42% W:10%` con colores segÃºn el nivel de uso (verde < 80 %, amarillo â‰¥ 80 %, rojo â‰¥ 100 %)
- **Panel visual**: abrÃ­ el panel con `Radar: Mostrar panel` para ver las barras animadas con Vegeta vigilando
- **Ruptura**: cuando una barra alcanza â‰¥ 90 %, se dispara una alerta visual

### InstalaciÃ³n

**Desde VS Code Marketplace**: buscÃ¡ **"Claude Sayayin Token Radar"** en la vista de extensiones e instalalo.

**Desde VSIX**:

1. DescargÃ¡ `radar-tokens-vegeta-1.0.0.vsix` de las releases del repo
2. En VS Code: Extensiones (Ctrl+Shift+X) â†’ â‹® â†’ **Install from VSIX...**
3. SeleccionÃ¡ el archivo

**Desde el cÃ³digo**:

```bash
cd vscode-radar
npm install
npm run compile && npm run cp:webview && npm run cp:assets
```

Luego abrÃ­ `vscode-radar/` en VS Code y presionÃ¡ **F5** para probarlo.

### Comandos

| Comando | DescripciÃ³n |
|---|---|
| `Radar: Mostrar panel` | Abre el panel con las barras y Vegeta |
| `Radar: Actualizar uso` | Fuerza una lectura nueva desde la API |
| `Radar: Cerrar panel` | Cierra el panel |

La extensiÃ³n arranca automÃ¡ticamente con VS Code. No requiere ningÃºn servidor externo.

---

## Arranque automÃ¡tico con Windows (sin ventana)

**`RadarDeTokens-Setup.exe` ya configura esto automÃ¡ticamente** â€” esta secciÃ³n es solo para quien instalÃ³ a mano.

El servidor inicia solo al iniciar sesiÃ³n, **en segundo plano y sin abrir ninguna ventana de consola**. El truco es que la tarea programada no ejecuta Node directamente, sino el lanzador `server/start-hidden.vbs`, que arranca Node con la ventana oculta (y usa el `node.exe` portable de `server/` si existe).

1. Abre **PowerShell** (puede ser normal, no hace falta administrador).
2. Navega a la carpeta `server/`:
   ```powershell
   cd "C:\ruta\completa\a\radar-vegeta-tokens\server"
   ```
3. Ejecuta este bloque â€” detecta la ruta automÃ¡ticamente desde donde estÃ¡s:
   ```powershell
   $vbs = Join-Path $PWD.Path "start-hidden.vbs"
   $accion = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $PWD.Path
   $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
   $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
   Register-ScheduledTask -TaskName "RadarDeTokens" -Action $accion -Trigger $trigger -Settings $settings -Force
   ```

El servidor arrancarÃ¡ invisible la prÃ³xima vez que inicies sesiÃ³n en Windows. Si arrancas otro `npm start` a mano mientras tanto, la segunda instancia detecta el puerto ocupado y se cierra sola sin error.

**Para detenerlo manualmente:** abre el Administrador de tareas, busca el proceso `node.exe` y termÃ­nalo, o ejecuta en PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 37123 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }
```

**Para verificar que estÃ¡ activo:** abre el Programador de tareas (`taskschd.msc`) y busca `RadarDeTokens`.

---

## Actualizar

```bash
git pull
```

No hay dependencias que reinstalar. Si el servidor estÃ¡ corriendo, reinÃ­cialo (mata el proceso `node` o reinicia Windows). En Chrome, ve a `chrome://extensions` y pulsa el botÃ³n **â†»** de la extensiÃ³n para recargarla.

Si usas arranque automÃ¡tico, reinicia la tarea desde el Programador de tareas o reinicia Windows.

---

## Desinstalar

**Quitar la extensiÃ³n:** en `chrome://extensions`, busca "Radar de Tokens" y pulsa **Eliminar**.

**Si instalaste con `RadarDeTokens-Setup.exe`:** andÃ¡ a "Agregar o quitar programas" de Windows, buscÃ¡ "Radar de Tokens" y desinstalalo. Eso detiene el servidor, borra la tarea programada y elimina `%LocalAppData%\RadarDeTokens\` completa.

**Si instalaste a mano:** detenÃ© y eliminÃ¡ el arranque automÃ¡tico con

```powershell
Unregister-ScheduledTask -TaskName "RadarDeTokens" -Confirm:$false
```

y borrÃ¡ la carpeta del repo.

---

## SoluciÃ³n de problemas

| SÃ­ntoma | Causa probable | SoluciÃ³n |
|---|---|---|
| El popup muestra "No se puede conectar con el servidor" | El servidor no estÃ¡ corriendo | VolvÃ© a correr `RadarDeTokens-Setup.exe`, o abre una terminal en `server/` y corre `node server.js` |
| El popup muestra "No se encontrÃ³ un token de Claude Code vÃ¡lido" | No has iniciado sesiÃ³n en Claude Code | Corre `claude` en la terminal y sigue el proceso de login |
| El popup muestra el error pero el servidor sÃ­ estÃ¡ corriendo | Token OAuth vencido | Corre `claude` en la terminal para refrescar la sesiÃ³n |
| `http://localhost:37123/usage` devuelve error de conexiÃ³n | Otro proceso usa el puerto 37123 | Cambia `PORT` en `server/server.js` y actualiza `popup.js` con el nuevo puerto |
| Las barras muestran 0% aunque uses Claude activamente | Las cabeceras de uso no vinieron en la respuesta | Estas cabeceras no son oficiales y pueden variar; intenta pulsar â†» Actualizar varias veces |
| El instalador no descarga Node | Sin conexiÃ³n o firewall bloqueando nodejs.org | Descarga `node.exe` (win-x64) de [nodejs.org/dist/latest-v22.x](https://nodejs.org/dist/latest-v22.x/win-x64/) y ponlo en `server/` (o en `%LocalAppData%\RadarDeTokens\server\` si ya instalaste) |

---

## Privacidad y aviso tÃ©cnico

- Tu token OAuth y tus datos de uso son **completamente locales**; nunca salen de tu mÃ¡quina excepto hacia `api.anthropic.com`.
- El token **nunca** se devuelve a la extensiÃ³n ni aparece en logs.
- Las cabeceras `anthropic-ratelimit-unified-*` **no son oficiales** â€” fueron descubiertas por ingenierÃ­a inversa del protocolo OAuth de Claude Code. Pueden cambiar o desaparecer sin previo aviso. Referencia: [claude-rate-monitor](https://github.com/nsanden/claude-rate-monitor).
- El modelo usado para la peticiÃ³n de sondeo es `claude-haiku-4-5-20251001` (el mÃ¡s barato disponible con token OAuth; Sonnet y Opus pueden devolver error 400 con este tipo de token).

---

**Apoyá el proyecto:** [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/kodevo)



