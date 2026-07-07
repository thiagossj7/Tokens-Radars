# Spec: Radar de Tokens para VS Code

**Fecha:** 2026-07-07 · **Proyecto:** Radar de Tokens — Vegeta

## 1. Problema

La extensión de Chrome requiere un servidor Node.js externo. En VS Code, donde ya hay un runtime Node.js y acceso completo al sistema de archivos, ese servidor es innecesario. El usuario quiere ver el uso de su plan de Claude directamente desde VS Code, sin procesos externos.

## 2. Arquitectura

Extensión VS Code autocontenida (TypeScript) que lee credenciales OAuth de Claude del sistema de archivos y consulta la API de Anthropic directamente. Cero dependencias externas. Dos canales de salida:

- **Status bar** — texto compacto, siempre visible, polling cada 60 s
- **WebView panel** — réplica visual del popup de Chrome, se abre al hacer clic en la status bar o automáticamente en caso de ruptura

```
extensión → fs.readFile(~/.claude/.credentials.json) → POST api.anthropic.com/v1/messages → extrae anthropic-ratelimit-unified-* → status bar + WebView
```

## 3. Componentes

### 3.1 `api.ts`

Código移植ado de `server.js` (`server/server.js:21-129`):

- **`leerCredenciales()`** — busca en `~/.claude/.credentials.json` y `~/.config/claude/.credentials.json`, devuelve `{ accessToken, refreshToken, expiresAt, rutaArchivo, jsonCompleto }` o `null`
- **`refreshearToken(creds)`** — POST a `claude.ai/api/auth/oauth/token` con `grant_type=refresh_token`, persiste el nuevo token en el archivo, devuelve `access_token`
- **`consultarUso(token)`** — POST a `api.anthropic.com/v1/messages` con modelo `claude-haiku-4-5-20251001`, 1 token "hi", cabecera `anthropic-beta: oauth-2025-04-20`. Extrae cabeceras `anthropic-ratelimit-unified-*`. Devuelve `{ session, week, representativeClaim, overage }`. Lanza `ErrorAutenticacion` en 401.
- **Cache interno**: 60 s, mismo patrón que `server.js:14-15,136-139`

Ningún token se loguea ni se expone a la UI. Solo sale hacia `api.anthropic.com` o `claude.ai`.

### 3.2 `extension.ts`

Punto de entrada de la extensión VS Code.

**Activation:** `onStartupFinished` (no bloquea el arranque de VS Code).

**StatusBarItem:**
- `alignment: StatusBarAlignment.Left`, `priority: 100`
- Texto formateado como `$(graph) <pctMayor> · <pctMenor>`
  - El valor que corresponde al `representativeClaim` va primero
  - Color del texto: `#ef4444` si ≥ 100%, `#eab308` si ≥ 80%, `#22c55e` si < 80%
  - Si ≥ 100%, añadir ` ⚠` al final
- Tooltip multilínea: `Sesión 5h: X% — se reinicia en Y h Z min\nSemana 7d: X% — se reinicia en Y h Z min`
- Al hacer clic → ejecuta comando `radar.showPanel`
- En estado de error: `$(alert) Claude: no auth` con tooltip de ayuda

**Polling:**
- Intervalo de 60 s
- Consulta inmediata al activarse
- El cache interno de `api.ts` (60 s) evita llamadas redundantes → una llamada real a Anthropic cada ~2 min como máximo
- En cada tick se evalúa: ¿alguna barra ≥ 100%? → `vscode.commands.executeCommand('radar.showPanel')` y envía señal de ruptura al WebView

**Comandos registrados:**
- `radar.refresh` — fuerza actualización (salta cache interno)
- `radar.showPanel` — abre/enfoca el WebView
- `radar.closePanel` — cierra el WebView

### 3.3 WebView panel

Panel en el editor (columna lateral, `vscode.ViewColumn.Beside`), tipo `WebviewPanel` con `retainContextWhenHidden: true` para mantener las animaciones incluso si el usuario cambia de pestaña.

Contenido HTML/CSS/JS adaptado de `extension/popup.html`, `extension/popup.css`, `extension/popup.js`.

**Adaptaciones respecto al popup de Chrome:**
- Las imágenes se referencian como `vscode.Uri` con `webview.asWebviewUri()` desde los assets de la extensión
- El `fetch()` a `localhost:37123` se reemplaza por comunicación `postMessage`:
  - WebView envía `{ type: 'requestUsage' }` al host
  - Host responde con `{ type: 'usageData', data: {...} }`
  - Host también envía `{ type: 'rupture' }` cuando detecta ≥ 100% en polling
- Se reusa la lógica de `animarBarra()`, `dispararRuptura()`, `pintarDatos()` → sin cambios
- Se reusa el mismo CSS del popup
- Se reusan todas las imágenes: `vegeta.webp`, `vegeta1.jpg`, `vegeta-scanning.gif`, `over.gif`, `icono.png`

### 3.4 `tipos.ts`

Interfaces compartidas:

```typescript
interface UsageData {
  session: { utilization: number; reset: number; status: string } | null;
  week: { utilization: number; reset: number; status: string } | null;
  representativeClaim: string | null;
  overage: string | null;
  updatedAt: string;
  cached: boolean;
  error: string | null;
}
```

## 4. Flujo de datos

```
[Activación]
    │
    ├─→ Crear StatusBarItem (texto: "$(sync~spin) Radar...")
    ├─→ Llamar refrescarUso()
    │      │
    │      ├─ ¿Cache válido? → usar cache
    │      ├─ ¿Credenciales? → no → mostrar error, tooltip "Corre claude en terminal"
    │      ├─ ¿Token expira en <30s? → refreshearToken()
    │      ├─ consultarUso(token)
    │      │      ├─ 401 + hay refreshToken → refreshearToken() + reintentar
    │      │      └─ 401 + no refreshToken → error "Sesión expirada"
    │      └─ Actualizar StatusBarItem
    │
    ├─→ Iniciar intervalo (60 s)
    │
    └─→ Registrar comandos: refresh, showPanel, closePanel

[Clic en status bar] → showPanel
    │
    └─→ Crear WebView
         └─→ postMessage { type: 'usageData', data: datosActuales }

[Polling detecta ≥ 100%]
    │
    ├─→ showPanel (si no está abierto)
    └─→ postMessage { type: 'rupture' }
```

## 5. Manejo de errores

| Escenario | Status bar | WebView |
|---|---|---|
| Credenciales no encontradas | `$(alert) Claude: no auth` | Tooltip: "Corre 'claude' en la terminal" |
| Token expirado sin refresh | `$(alert) Claude: expirado` | Tooltip: "Reinicia sesión con 'claude'" |
| Red caída / timeout | `$(alert) Claude: sin red` | Tooltip: "No se pudo contactar a Anthropic" |
| 400 de API | `$(alert) Claude: error` | Tooltip con body del error |
| Cualquier error en WebView | Mensaje en el propio panel | Texto de error + botón reintentar |

## 6. Seguridad

- Mismas reglas que `server.js`: `accessToken` solo sale a `api.anthropic.com`, `refreshToken` solo a `claude.ai`. Ninguno llega al WebView ni a logs.
- WebView recibe datos via `postMessage`, no tiene acceso a `fs` ni a la red.
- No se empaquetan credenciales en la extensión.

## 7. Archivos del proyecto

```
vscode-radar/
├── package.json          # nombre, activationEvents, contributes.commands
├── tsconfig.json
├── .vscodeignore
├── src/
│   ├── extension.ts      # activate/deactivate, StatusBarItem, polling, showPanel
│   ├── api.ts            # leerCredenciales, refreshearToken, consultarUso, cache
│   ├── tipos.ts          # UsageData y tipos auxiliares
│   └── webview/
│       ├── panel.html    # adaptado de extension/popup.html
│       ├── panel.css     # copia de extension/popup.css
│       └── panel.js      # adaptado de extension/popup.js (postMessage en vez de fetch)
└── assets/
    ├── icono.png         # icono de la extensión VS Code
    ├── vegeta.webp
    ├── vegeta1.jpg
    ├── vegeta-scanning.gif
    └── over.gif
```

El WebView se construye inline en el host con `webview.html` como string template (patrón estándar VS Code). Las imágenes se sirven como `webview.asWebviewUri()`.

## 8. No incluido (YAGNI)

- Configuración de usuario (`package.json#contributes.configuration`) — el puerto, modelo, intervalo son internos
- TreeView personalizado
- Comando para cambiar el modelo de API
- Soporte multi-cuenta
- Telemetría
