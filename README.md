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

- **Node.js** — [nodejs.org](https://nodejs.org) (cualquier versión LTS)
- **Google Chrome**
- **Claude Code** instalado y con sesión iniciada — corre `claude` en la terminal al menos una vez para generar el token en `~/.claude/.credentials.json`

---

## Instalación

### Paso 1 — Instalar dependencias del servidor

Abre una terminal, navega a la carpeta `server/` y ejecuta:

```bash
cd server
npm install
```

Solo hace falta hacerlo una vez.

### Paso 2 — Arrancar el servidor

```bash
npm start
```

Verás: `Servidor de uso en http://localhost:37123 — deja esta ventana abierta.`

Para verificar que funciona, abre en el navegador: `http://localhost:37123/usage`

Deberías ver un JSON con los campos `session`, `week`, `updatedAt`, etc.

### Paso 3 — Cargar la extensión en Chrome

1. Abre `chrome://extensions`
2. Activa **"Modo de desarrollador"** (interruptor en la esquina superior derecha)
3. Pulsa **"Cargar descomprimida"**
4. Selecciona la carpeta `extension/` de este proyecto

El icono del radar aparecerá en la barra de Chrome. Púlsalo para ver tus barras de uso.

---

## Uso diario

- **Al abrir el popup** se muestra el último dato disponible (puede venir de la caché del servidor, sin gastar cupo).
- **Botón ↻ Actualizar** — fuerza una lectura nueva contra la API. Úsalo cuando quieras el dato más reciente; cada pulsación hace una petición mínima (Haiku, 1 token) que gasta una pizca de tu plan.
- La barra con borde dorado es la que actualmente te está limitando (`representative claim`).
- Si una barra supera el 100 %, se muestra en rojo con el símbolo ⚠.

---

## Arranque automático con Windows

Para que el servidor inicie solo al encender el PC sin necesidad de abrir una terminal:

1. Abre **PowerShell** (puede ser normal, no hace falta administrador).
2. Navega a la carpeta `server/`:
   ```powershell
   cd "C:\ruta\completa\a\radar-vegeta-tokens\server"
   ```
3. Ejecuta este bloque — detecta la ruta automáticamente desde donde estás:
   ```powershell
   $node = (Get-Command node).Source
   $ruta = $PWD.Path
   $accion = New-ScheduledTaskAction -Execute $node -Argument "server.js" -WorkingDirectory $ruta
   $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
   $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit 0 -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
   Register-ScheduledTask -TaskName "RadarDeTokens" -Action $accion -Trigger $trigger -Settings $settings -Force
   ```

El servidor arrancará en segundo plano la próxima vez que inicies sesión en Windows.

**Para verificar que está activo:** abre el Programador de tareas (`taskschd.msc`) y busca `RadarDeTokens`.

---

## Actualizar

```bash
git pull
cd server
npm install   # solo si cambiaron las dependencias
```

Luego, si el servidor está corriendo, reinícialo (`Ctrl+C` y `npm start` de nuevo). En Chrome, ve a `chrome://extensions` y pulsa el botón **↻** de la extensión para recargarla.

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
| El popup muestra "No se puede conectar con el servidor" | El servidor no está corriendo | Abre una terminal, ve a `server/` y corre `npm start` |
| El popup muestra "No se encontró un token de Claude Code válido" | No has iniciado sesión en Claude Code | Corre `claude` en la terminal y sigue el proceso de login |
| El popup muestra el error pero el servidor sí está corriendo | Token OAuth vencido | Corre `claude` en la terminal para refrescar la sesión |
| `http://localhost:37123/usage` devuelve error de conexión | Otro proceso usa el puerto 37123 | Cambia `PORT` en `server/server.js` y actualiza `popup.js` con el nuevo puerto |
| Las barras muestran 0% aunque uses Claude activamente | Las cabeceras de uso no vinieron en la respuesta | Estas cabeceras no son oficiales y pueden variar; intenta pulsar ↻ Actualizar varias veces |
| `npm install` falla | Versión de Node.js incompatible | Actualiza Node.js a la versión LTS más reciente |

---

## Privacidad y aviso técnico

- Tu token OAuth y tus datos de uso son **completamente locales**; nunca salen de tu máquina excepto hacia `api.anthropic.com`.
- El token **nunca** se devuelve a la extensión ni aparece en logs.
- Las cabeceras `anthropic-ratelimit-unified-*` **no son oficiales** — fueron descubiertas por ingeniería inversa del protocolo OAuth de Claude Code. Pueden cambiar o desaparecer sin previo aviso. Referencia: [claude-rate-monitor](https://github.com/nsanden/claude-rate-monitor).
- El modelo usado para la petición de sondeo es `claude-haiku-4-5-20251001` (el más barato disponible con token OAuth; Sonnet y Opus pueden devolver error 400 con este tipo de token).
