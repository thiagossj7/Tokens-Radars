# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos de desarrollo

```bash
# Arrancar el servidor (sin npm install — no hay dependencias)
cd server && node server.js

# Verificar que responde
curl http://localhost:37123/usage
```

Para la extensión: `chrome://extensions` → Modo desarrollador → Cargar descomprimida → carpeta `extension/`. Tras editar, recargar con el botón ↻ en esa página.

## Arquitectura

Dos piezas independientes que se comunican solo por HTTP:

**`server/server.js`** — un único archivo Node.js sin dependencias (solo `http`, `https`, `fs`, `path`, `os`). Puerto fijo `37123`. Flujo por petición:
1. Lee `~/.claude/.credentials.json` (o `~/.config/claude/...`), extrae `claudeAiOauth.accessToken`.
2. Si el token expira en < 30 s o ya expiró (campo `expiresAt`), hace pre-refresh antes de llamar a la API.
3. POST a `api.anthropic.com/v1/messages` con modelo `claude-haiku-4-5-20251001` (1 token, "hi") y cabecera `anthropic-beta: oauth-2025-04-20`. **Sonnet y Opus fallan con token OAuth** — no cambiar el modelo.
4. Extrae las cabeceras `anthropic-ratelimit-unified-*` de la respuesta y las serializa como JSON.
5. Si recibe 401, hace refresh via `claude.ai/api/auth/oauth/token` y reintenta. Persiste el token nuevo en el mismo archivo de credenciales.
6. Caché de 60 s en memoria (`cache.data` + `cache.timestamp`). `?force=true` lo omite.

**`extension/`** — popup sin build step. Solo hace `fetch('http://localhost:37123/usage')`. No tiene acceso a credenciales.

## Contrato del endpoint `/usage`

```json
{
  "session": { "utilization": 0.42, "reset": 1760000000, "status": "active" },
  "week":    { "utilization": 0.10, "reset": 1760400000, "status": "active" },
  "representativeClaim": "five_hour",
  "overage": null,
  "updatedAt": "ISO-8601",
  "cached": false,
  "error": null
}
```

`utilization` es 0.0–1.0+ (puede superar 1 al estar en sobrecupo). `representativeClaim` (`five_hour` | `seven_day`) indica la barra limitante; el popup la resalta con borde dorado (clase CSS `activa`).

## Popup: lógica no obvia

- Animaciones con **Web Animations API** (`element.animate()` + `await .finished`), nunca `setTimeout` para encadenar pasos. Semanal arranca con 150 ms de desfase respecto a sesión.
- Umbrales de color: ≥ 0.8 → clase `alerta`; ≥ 1.0 → clase `critica` + símbolo ⚠.
- **Secuencia de ruptura** (≥ 90%): flash rojo en el grupo de la barra → pulso rojo en la imagen `.vegeta-img` → overlay a pantalla completa. La variable `rupturaEnCurso` evita disparos en paralelo si el usuario actualiza durante la animación.
- El overlay no reaparece si el usuario lo cerró con ✕ en la misma apertura del popup (`overlayDismissed = true`). Al volver a abrir el popup la variable se resetea.
- GIF del overlay: `images/over.gif` si solo la barra semanal supera el 90%; `images/vegeta-scanning.gif` en cualquier otro caso (sesión sola, o ambas).

## Seguridad

El `accessToken` solo sale hacia `api.anthropic.com`. El `refreshToken` solo va a `claude.ai`. Ninguno de los dos llega al frontend (`/usage` solo devuelve datos de uso) ni aparece en logs.

## Instalación de usuario final

`RadarDeTokens-Setup.exe` — instalador gráfico nativo compilado con Inno Setup (fuente en `installer/setup.iss`, lógica en Pascal Script dentro del mismo `[Code]`, más cinco scripts auxiliares ocultos en `installer/scripts/`: `buscar-node.ps1`, `descargar-node.ps1`, `preparar-claude.ps1`, `registrar-tarea.ps1`, `verificar-servidor.ps1`, `detener-servidor.ps1`). Sin ventanas de consola en ningún momento. El wizard copia `server/` y `extension/` a `%LocalAppData%\RadarDeTokens\`, descarga `node.exe` portable si hace falta, espera el login de Claude con una página de progreso que sondea en segundo plano, y registra la tarea programada `RadarDeTokens` que lanza `server/start-hidden.vbs` (arranque invisible). El desinstalador autogenerado detiene el servidor (identifica el proceso por el puerto 37123, no por nombre, para no matar otros `node.exe`), borra la tarea programada y elimina la carpeta instalada.

Recompilar: `ISCC installer/setup.iss` desde la raíz del proyecto (genera `RadarDeTokens-Setup.exe`). Las imágenes del wizard (`installer/assets/wizard-image.bmp` y `wizard-small.bmp`) se regeneran con `installer/assets/generar-imagenes.ps1` si cambian las imágenes fuente de la extensión.

**Para pruebas:** el instalador acepta parámetros de línea de comandos solo para testing — `/TaskName=` (nombre de tarea programada alternativo) y `/CredsPathOverride=` (ruta de credenciales alternativa) — para no tocar la tarea `RadarDeTokens` real ni las credenciales reales del usuario al probar. **Importante:** si se prueba la desinstalación con un `/TaskName=` no default, hay que pasarle el mismo parámetro también a `unins000.exe`, porque el instalador y el desinstalador son procesos separados que no comparten parámetros automáticamente — olvidar esto borra la tarea programada real.

## Convenciones

- Todo el código, comentarios y mensajes de UI en **español**, incluidos los identificadores (`leerCredenciales`, `dispararRuptura`, `manejarUsage`…).
- Las imágenes de producción van en `extension/images/` con nombres limpios; la raíz del workspace tiene los archivos fuente. No referenciar la raíz desde el HTML.
- Las cabeceras `anthropic-ratelimit-unified-*` son **no oficiales** (ingeniería inversa); pueden desaparecer sin aviso.
- `README.md` menciona "Node.js + Express" en su descripción — es incorrecto (reliquia). No corregirlo para no perder contexto histórico del repo.
