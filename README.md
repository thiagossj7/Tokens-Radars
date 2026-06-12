# Radar de Tokens — Vegeta

Extensión de Google Chrome que muestra tu uso del plan de Claude en tiempo real con Vegeta vigilando.

Dos barras de progreso: **Sesión (ventana de 5 horas)** y **Semanal (ventana de 7 días)**. El dato refleja todo tu consumo del plan — web, app y Claude Code — porque se lee directamente desde las cabeceras de la API de Anthropic con tu token OAuth.

---

## Cómo funciona

El proyecto tiene dos piezas:

1. **Servidor local** (`server/`) — Node.js + Express corriendo en `localhost:37123`. Lee tu token OAuth guardado por Claude Code y hace una petición mínima a `api.anthropic.com` para extraer las cabeceras de uso. El token **nunca** sale de tu máquina ni llega a la extensión.

2. **Extensión Chrome** (`extension/`) — solo consume `http://localhost:37123/usage` y pinta las barras. No tiene acceso a credenciales.

---

## Requisitos

- **Google Chrome**
- **Una cuenta de Claude** (plan Pro/Max) — la extensión muestra el uso de *tu* plan

No hace falta tener Node.js ni Claude Code instalados: el instalador se encarga de ambos.

---

## Instalación (un clic)

### Paso 1 — Ejecutar el instalador

Haz **doble clic en `instalar.bat`** (en la raíz del proyecto). El instalador:

1. Busca Node.js; si no está, **descarga un `node.exe` portable oficial** (~83 MB) dentro de `server/` — sin permisos de administrador y sin instalar nada en el sistema.
2. Busca tus credenciales de Claude; si faltan, **instala Claude Code** con el instalador oficial de Anthropic y abre una ventana para que inicies sesión (espera hasta que termines el login).
3. Registra el **arranque automático invisible**: el servidor se inicia solo en cada inicio de sesión de Windows, sin ninguna ventana.
4. Arranca el servidor de inmediato y verifica que `http://localhost:37123/usage` responde.

El servidor no tiene dependencias (`npm install` ya no existe en este proyecto): es un único `server.js` que solo usa módulos nativos de Node.

### Paso 2 — Cargar la extensión en Chrome

1. Abre `chrome://extensions`
2. Activa **"Modo de desarrollador"** (interruptor en la esquina superior derecha)
3. Pulsa **"Cargar descomprimida"**
4. Selecciona la carpeta `extension/` de este proyecto

El icono del radar aparecerá en la barra de Chrome. Púlsalo para ver tus barras de uso.

### Alternativa manual (sin instalador)

Si prefieres no usar `instalar.bat`: con Node instalado, corre `cd server && npm start` y deja la ventana abierta (el bloque de PowerShell de la sección de arranque automático registra la versión invisible).

---

## Uso diario

- **Al abrir el popup** se muestra el último dato disponible (puede venir de la caché del servidor, sin gastar cupo).
- **Botón ↻ Actualizar** — fuerza una lectura nueva contra la API. Úsalo cuando quieras el dato más reciente; cada pulsación hace una petición mínima (Haiku, 1 token) que gasta una pizca de tu plan.
- La barra con borde dorado es la que actualmente te está limitando (`representative claim`).
- Si una barra supera el 100 %, se muestra en rojo con el símbolo ⚠.

---

## Arranque automático con Windows (sin ventana)

**`instalar.bat` ya configura esto automáticamente** — esta sección es solo para quien instaló a mano.

El servidor inicia solo al iniciar sesión, **en segundo plano y sin abrir ninguna ventana de consola**. El truco es que la tarea programada no ejecuta Node directamente, sino el lanzador `server/start-hidden.vbs`, que arranca Node con la ventana oculta (y usa el `node.exe` portable de `server/` si existe).

1. Abre **PowerShell** (puede ser normal, no hace falta administrador).
2. Navega a la carpeta `server/`:
   ```powershell
   cd "C:\ruta\completa\a\radar-vegeta-tokens\server"
   ```
3. Ejecuta este bloque — detecta la ruta automáticamente desde donde estás:
   ```powershell
   $vbs = Join-Path $PWD.Path "start-hidden.vbs"
   $accion = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`"" -WorkingDirectory $PWD.Path
   $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
   $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
   Register-ScheduledTask -TaskName "RadarDeTokens" -Action $accion -Trigger $trigger -Settings $settings -Force
   ```

El servidor arrancará invisible la próxima vez que inicies sesión en Windows. Si arrancas otro `npm start` a mano mientras tanto, la segunda instancia detecta el puerto ocupado y se cierra sola sin error.

**Para detenerlo manualmente:** abre el Administrador de tareas, busca el proceso `node.exe` y termínalo, o ejecuta en PowerShell:
```powershell
Get-NetTCPConnection -LocalPort 37123 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess }
```

**Para verificar que está activo:** abre el Programador de tareas (`taskschd.msc`) y busca `RadarDeTokens`.

---

## Actualizar

```bash
git pull
```

No hay dependencias que reinstalar. Si el servidor está corriendo, reinícialo (mata el proceso `node` o reinicia Windows). En Chrome, ve a `chrome://extensions` y pulsa el botón **↻** de la extensión para recargarla.

Si usas arranque automático, reinicia la tarea desde el Programador de tareas o reinicia Windows.

---

## Desinstalar

**Quitar la extensión:** en `chrome://extensions`, busca "Radar de Tokens" y pulsa **Eliminar**.

**Detener y eliminar el arranque automático** (si lo configuraste):

```powershell
Unregister-ScheduledTask -TaskName "RadarDeTokens" -Confirm:$false
```

**Eliminar el servidor:** simplemente borra la carpeta `radar-vegeta-tokens/`.

---

## Solución de problemas

| Síntoma | Causa probable | Solución |
|---|---|---|
| El popup muestra "No se puede conectar con el servidor" | El servidor no está corriendo | Ejecuta `instalar.bat` de nuevo, o abre una terminal en `server/` y corre `node server.js` |
| El popup muestra "No se encontró un token de Claude Code válido" | No has iniciado sesión en Claude Code | Corre `claude` en la terminal y sigue el proceso de login |
| El popup muestra el error pero el servidor sí está corriendo | Token OAuth vencido | Corre `claude` en la terminal para refrescar la sesión |
| `http://localhost:37123/usage` devuelve error de conexión | Otro proceso usa el puerto 37123 | Cambia `PORT` en `server/server.js` y actualiza `popup.js` con el nuevo puerto |
| Las barras muestran 0% aunque uses Claude activamente | Las cabeceras de uso no vinieron en la respuesta | Estas cabeceras no son oficiales y pueden variar; intenta pulsar ↻ Actualizar varias veces |
| El instalador no descarga Node | Sin conexión o firewall bloqueando nodejs.org | Descarga `node.exe` (win-x64) de [nodejs.org/dist/latest-v22.x](https://nodejs.org/dist/latest-v22.x/win-x64/) y ponlo en `server/` |

---

## Privacidad y aviso técnico

- Tu token OAuth y tus datos de uso son **completamente locales**; nunca salen de tu máquina excepto hacia `api.anthropic.com`.
- El token **nunca** se devuelve a la extensión ni aparece en logs.
- Las cabeceras `anthropic-ratelimit-unified-*` **no son oficiales** — fueron descubiertas por ingeniería inversa del protocolo OAuth de Claude Code. Pueden cambiar o desaparecer sin previo aviso. Referencia: [claude-rate-monitor](https://github.com/nsanden/claude-rate-monitor).
- El modelo usado para la petición de sondeo es `claude-haiku-4-5-20251001` (el más barato disponible con token OAuth; Sonnet y Opus pueden devolver error 400 con este tipo de token).
