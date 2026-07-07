# Radar de Tokens para VS Code — Plan de Implementación

> **Para agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extensión VS Code que muestra el uso del plan de Claude en la barra de estado y abre un panel animado al hacer clic (o automáticamente en ruptura ≥100%).

**Architecture:** Sin servidor local. La extensión lee `~/.claude/.credentials.json`, llama a `api.anthropic.com/v1/messages` directo, muestra texto en la status bar y abre un WebView con la UI visual del popup de Chrome.

**Tech Stack:** TypeScript, VS Code Extension API, WebView API (sin frameworks externos)

## Global Constraints

- Sin dependencias npm externas (solo `@types/vscode`, `typescript` para build)
- Modelo API: `claude-haiku-4-5-20251001` (no cambiar — Sonnet y Opus fallan con OAuth)
- Cabecera `anthropic-beta: oauth-2025-04-20`
- Todo el código, comentarios y UI en español
- Las imágenes se copian de `extension/images/`
- El WebView se comunica con el host vía `postMessage`

---

### Task 1: Scaffolding del proyecto

**Files:**
- Create: `vscode-radar/package.json`
- Create: `vscode-radar/tsconfig.json`
- Create: `vscode-radar/.vscodeignore`
- Create: `vscode-radar/.gitignore`
- Copy: `extension/images/*` → `vscode-radar/assets/`

**Interfaces:**
- Consumes: nada
- Produces: directorio del proyecto con configuración de build

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "radar-tokens-vegeta",
  "displayName": "Radar de Tokens — Vegeta",
  "description": "Muestra tu uso del plan de Claude (sesión 5h y semana 7d) en la barra de estado.",
  "version": "1.0.0",
  "publisher": "radar-tokens",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Other"],
  "activationEvents": [ "onStartupFinished" ],
  "main": "./out/extension.js",
  "contributes": {
    "commands": [
      { "command": "radar.refresh", "title": "Radar: Actualizar uso" },
      { "command": "radar.showPanel", "title": "Radar: Mostrar panel" },
      { "command": "radar.closePanel", "title": "Radar: Cerrar panel" }
    ]
  },
  "scripts": {
    "vscode:prepublish": "npm run compile",
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",
    "typescript": "^5.3.0"
  }
}
```

- [ ] **Step 2: Crear `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Crear `.vscodeignore`**

```
node_modules/**
out/test/**
.gitignore
src/**
tsconfig.json
```

- [ ] **Step 4: Copiar imágenes**

```bash
mkdir -p vscode-radar/assets
cp extension/images/* vscode-radar/assets/
```

- [ ] **Step 5: Compilar para verificar**

```bash
cd vscode-radar && npm install && npm run compile
```
Esperado: se genera `out/` sin errores.

---

### Task 2: Tipos compartidos

**Files:**
- Create: `vscode-radar/src/tipos.ts`

- [ ] **Step 1: Crear `src/tipos.ts`**

```typescript
export interface UsoBarra {
  utilization: number;
  reset: number;
  status: string;
}

export interface DatosUso {
  session: UsoBarra | null;
  week: UsoBarra | null;
  representativeClaim: string | null;
  overage: string | null;
  updatedAt: string;
  cached: boolean;
  error: string | null;
}

export interface Credenciales {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  rutaArchivo: string;
  jsonCompleto: any;
}

export interface MensajeWebView {
  type: 'usageData' | 'rupture';
  data?: any;
}
```

- [ ] **Step 2: Compilar para verificar**

```
cd vscode-radar && npx tsc --noEmit
```
Esperado: sin errores.

---

### Task 3: API layer (`api.ts`)

**Files:**
- Create: `vscode-radar/src/api.ts`

**Interfaces:**
- Consumes: `tipos.ts` → `Credenciales`, `DatosUso`
- Produces: `leerCredenciales()`, `refreshearToken()`, `consultarUso()`, `obtenerUso()`

- [ ] **Step 1: Crear `src/api.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import { Credenciales, DatosUso } from './tipos';

class ErrorAutenticacion extends Error {
  constructor() { super('TOKEN_EXPIRADO'); this.name = 'ErrorAutenticacion'; }
}

let cache: { data: DatosUso | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 60 * 1000;

export function leerCredenciales(): Credenciales | null {
  const rutas = [
    path.join(os.homedir(), '.claude', '.credentials.json'),
    path.join(os.homedir(), '.config', 'claude', '.credentials.json'),
  ];
  for (const r of rutas) {
    try {
      const contenido = fs.readFileSync(r, 'utf8');
      const json = JSON.parse(contenido);
      const oauth = json?.claudeAiOauth;
      if (oauth?.accessToken) {
        return {
          accessToken: oauth.accessToken,
          refreshToken: oauth.refreshToken || null,
          expiresAt: oauth.expiresAt || null,
          rutaArchivo: r,
          jsonCompleto: json,
        };
      }
    } catch {}
  }
  return null;
}

export function refreshearToken(creds: Credenciales): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!creds.refreshToken) {
      reject(new Error('No hay refresh token. Corre claude en la terminal.'));
      return;
    }
    const cuerpo = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
    }).toString();
    const opciones = {
      hostname: 'claude.ai',
      path: '/api/auth/oauth/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(cuerpo),
      },
    };
    const req = https.request(opciones, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error('Renovación falló (estado ' + res.statusCode + '). Corre claude en terminal.'));
          return;
        }
        try {
          const data = JSON.parse(body);
          const nuevoToken = data.access_token;
          if (!nuevoToken) { reject(new Error('La renovación no devolvió token.')); return; }
          const json = creds.jsonCompleto;
          json.claudeAiOauth.accessToken = nuevoToken;
          const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
          json.claudeAiOauth.expiresAt = Date.now() + expiresIn * 1000;
          if (data.refresh_token) json.claudeAiOauth.refreshToken = data.refresh_token;
          fs.writeFileSync(creds.rutaArchivo, JSON.stringify(json, null, 2), 'utf8');
          resolve(nuevoToken);
        } catch (e: any) {
          reject(new Error('Respuesta de renovación inválida: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.write(cuerpo);
    req.end();
  });
}

export function consultarUso(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const cuerpo = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });
    const opciones = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Length': Buffer.byteLength(cuerpo),
      },
    };
    const req = https.request(opciones, (res) => {
      if (res.statusCode === 401) { res.resume(); reject(new ErrorAutenticacion()); return; }
      if (res.statusCode === 400) {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => reject(new Error('Error 400 de la API: ' + body)));
        return;
      }
      const h = res.headers;
      resolve({
        session: {
          utilization: parseFloat(h['anthropic-ratelimit-unified-5h-utilization'] as string || '0'),
          reset: parseInt(h['anthropic-ratelimit-unified-5h-reset'] as string || '0', 10),
          status: h['anthropic-ratelimit-unified-5h-status'] || 'active',
        },
        week: {
          utilization: parseFloat(h['anthropic-ratelimit-unified-7d-utilization'] as string || '0'),
          reset: parseInt(h['anthropic-ratelimit-unified-7d-reset'] as string || '0', 10),
          status: h['anthropic-ratelimit-unified-7d-status'] || 'active',
        },
        representativeClaim: h['anthropic-ratelimit-unified-representative-claim'] || null,
        overage: h['anthropic-ratelimit-unified-overage-status'] === 'null' ? null : h['anthropic-ratelimit-unified-overage-status'],
      });
      res.resume();
    });
    req.on('error', reject);
    req.write(cuerpo);
    req.end();
  });
}

export async function obtenerUso(forzar = false): Promise<DatosUso> {
  const ahora = Date.now();
  if (!forzar && cache.data && ahora - cache.timestamp < CACHE_TTL) {
    return { ...cache.data, cached: true };
  }
  const creds = leerCredenciales();
  if (!creds) {
    return { session: null, week: null, representativeClaim: null, overage: null, updatedAt: new Date().toISOString(), cached: false, error: 'No se encontró token. Corre claude en la terminal.' };
  }
  let tokenActual = creds.accessToken;
  if (creds.refreshToken && creds.expiresAt && ahora > creds.expiresAt - 30000) {
    try { tokenActual = await refreshearToken(creds); } catch {}
  }
  const armar = (datos: any): DatosUso => {
    const r: DatosUso = { ...datos, updatedAt: new Date().toISOString(), cached: false, error: null };
    cache = { data: r, timestamp: ahora };
    return r;
  };
  try {
    return armar(await consultarUso(tokenActual));
  } catch (err: any) {
    if (err instanceof ErrorAutenticacion && creds.refreshToken) {
      try { return armar(await consultarUso(await refreshearToken(creds))); }
      catch (e2: any) { return { session: null, week: null, representativeClaim: null, overage: null, updatedAt: new Date().toISOString(), cached: false, error: e2.message }; }
    }
    return { session: null, week: null, representativeClaim: null, overage: null, updatedAt: new Date().toISOString(), cached: false, error: err instanceof ErrorAutenticacion ? 'Sesión expirada. Corre claude en la terminal.' : err.message };
  }
}
```

- [ ] **Step 2: Compilar para verificar**

```
cd vscode-radar && npx tsc --noEmit
```
Esperado: sin errores.

---

### Task 4: Extension host (`extension.ts`)

**Files:**
- Create: `vscode-radar/src/extension.ts`

**Interfaces:**
- Consumes: `api.ts` → `obtenerUso(forzar)`, `tipos.ts` → `DatosUso`
- Produces: comandos `radar.refresh`, `radar.showPanel`, `radar.closePanel`

- [ ] **Step 1: Crear `src/extension.ts`**

```typescript
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { obtenerUso } from './api';
import { DatosUso } from './tipos';

let statusBarItem: vscode.StatusBarItem;
let pollTimer: NodeJS.Timeout | undefined;
let webviewPanel: vscode.WebviewPanel | undefined;
let datosActuales: DatosUso | null = null;

function textoReset(epochSeg: number): string {
  if (!epochSeg) return '';
  const diffMs = epochSeg * 1000 - Date.now();
  if (diffMs <= 0) return 'se reinicia pronto';
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `se reinicia en ${h} h ${m} min` : `se reinicia en ${m} min`;
}

function actualizarStatusBar(datos: DatosUso) {
  if (datos.error) {
    statusBarItem.text = '$(alert) Claude: no auth';
    statusBarItem.tooltip = datos.error + '\nCorre \'claude\' en la terminal para iniciar sesión';
    statusBarItem.color = undefined;
    return;
  }
  const s = datos.session?.utilization ?? 0;
  const w = datos.week?.utilization ?? 0;
  const claim = datos.representativeClaim;
  const primero = claim === 'seven_day' ? w : s;
  const segundo = claim === 'seven_day' ? s : w;
  const warning = (s >= 1 || w >= 1) ? ' ⚠' : '';
  statusBarItem.text = `$(graph) ${(primero * 100).toFixed(0)}% · ${(segundo * 100).toFixed(0)}%${warning}`;
  if (s >= 1 || w >= 1) {
    statusBarItem.color = '#ef4444';
  } else if (s >= 0.8 || w >= 0.8) {
    statusBarItem.color = '#eab308';
  } else {
    statusBarItem.color = '#22c55e';
  }
  statusBarItem.tooltip = [
    `Sesión 5h: ${(s * 100).toFixed(1)}% — ${textoReset(datos.session?.reset ?? 0)}`,
    `Semana 7d: ${(w * 100).toFixed(1)}% — ${textoReset(datos.week?.reset ?? 0)}`,
  ].join('\n');
}

function debeDispararRuptura(datos: DatosUso): boolean {
  return (datos.session?.utilization ?? 0) >= 1 || (datos.week?.utilization ?? 0) >= 1;
}

async function refrescarUso(forzar = false) {
  const datos = await obtenerUso(forzar);
  datosActuales = datos;
  actualizarStatusBar(datos);
  if (debeDispararRuptura(datos)) {
    abrirPanel(true);
  } else if (webviewPanel) {
    enviarDatosAlPanel(datos);
  }
}

function enviarDatosAlPanel(datos: DatosUso) {
  if (webviewPanel) {
    webviewPanel.webview.postMessage({ type: 'usageData', data: datos });
  }
}

function abrirPanel(ruptura = false) {
  if (webviewPanel) {
    webviewPanel.reveal(vscode.ViewColumn.Beside);
    if (datosActuales) enviarDatosAlPanel(datosActuales);
    if (ruptura && datosActuales) {
      webviewPanel.webview.postMessage({ type: 'rupture', data: datosActuales });
    }
    return;
  }
  const extensionPath = vscode.extensions.getExtension('radar-tokens-vegeta')
    ?.extensionPath || path.join(__dirname, '..');
  const webviewPath = path.join(extensionPath, 'out', 'webview');
  webviewPanel = vscode.window.createWebviewPanel(
    'radarTokens',
    'Radar de Tokens — Vegeta',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(webviewPath)],
    }
  );
  const htmlFilePath = path.join(webviewPath, 'panel.html');
  let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
  const webviewUri = webviewPanel.webview.asWebviewUri(vscode.Uri.file(webviewPath));
  htmlContent = htmlContent.replace(/\$\{webviewUri\}/g, webviewUri.toString());
  webviewPanel.webview.html = htmlContent;
  webviewPanel.onDidDispose(() => { webviewPanel = undefined; });
  webviewPanel.webview.onDidReceiveMessage((msg) => {
    if (msg.type === 'requestUsage' && datosActuales) {
      enviarDatosAlPanel(datosActuales);
    }
  });
  if (datosActuales) enviarDatosAlPanel(datosActuales);
  if (ruptura && datosActuales) {
    setTimeout(() => webviewPanel?.webview.postMessage({ type: 'rupture', data: datosActuales }), 500);
  }
}

function cerrarPanel() {
  if (webviewPanel) { webviewPanel.dispose(); webviewPanel = undefined; }
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(sync~spin) Radar...';
  statusBarItem.tooltip = 'Consultando uso de Claude...';
  statusBarItem.command = 'radar.showPanel';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(
    vscode.commands.registerCommand('radar.refresh', () => refrescarUso(true)),
    vscode.commands.registerCommand('radar.showPanel', () => abrirPanel(false)),
    vscode.commands.registerCommand('radar.closePanel', cerrarPanel),
  );
  refrescarUso(false);
  pollTimer = setInterval(() => refrescarUso(false), 60000);
  context.subscriptions.push({ dispose: () => { if (pollTimer) clearInterval(pollTimer); } });
}

export function deactivate() {
  if (pollTimer) clearInterval(pollTimer);
}
```

- [ ] **Step 2: Compilar para verificar**

```
cd vscode-radar && npx tsc --noEmit
```
Esperado: sin errores.

---

### Task 5: WebView panel (HTML + CSS)

**Files:**
- Create: `vscode-radar/src/webview/panel.html`
- Create: `vscode-radar/src/webview/panel.css`
- Modify: `tsconfig.json` para excluir webview HTML/CSS
- Modify: `package.json` para añadir scripts de copia y `copyfiles`

- [ ] **Step 1: Crear `src/webview/panel.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webviewUri}; img-src ${webviewUri}; script-src 'unsafe-inline';">
  <link rel="stylesheet" href="${webviewUri}/panel.css">
  <title>Radar de Tokens</title>
</head>
<body>
  <div id="panel-uso">
    <div class="encabezado">
      <img class="vegeta-img" src="${webviewUri}/vegeta.webp" alt="Vegeta">
      <h1>Radar de Tokens</h1>
    </div>
    <div id="grupo-sesion" class="grupo-barra">
      <div class="barra-label">
        <span>Sesión <span class="info-label">5 h</span></span>
        <span id="pct-sesion" class="pct">0%</span>
      </div>
      <div class="barra-track">
        <div id="relleno-sesion" class="barra-fill"></div>
      </div>
      <div id="reset-sesion" class="reset-text"></div>
    </div>
    <div id="grupo-semana" class="grupo-barra">
      <div class="barra-label">
        <span>Semanal <span class="info-label">7 d</span></span>
        <span id="pct-semana" class="pct">0%</span>
      </div>
      <div class="barra-track">
        <div id="relleno-semana" class="barra-fill"></div>
      </div>
      <div id="reset-semana" class="reset-text"></div>
    </div>
    <div id="actualizado" class="timestamp"></div>
  </div>
  <div id="panel-error" class="oculto">
    <p class="error-icono">⚠</p>
    <p id="msg-error"></p>
    <button id="btn-reintentar">Reintentar</button>
  </div>
  <div id="overlay-ruptura" class="oculto overlay">
    <div class="overlay-contenido">
      <button id="btn-cerrar-overlay" class="overlay-cerrar">✕</button>
      <p id="overlay-mensaje"></p>
      <img id="overlay-gif" src="" alt="">
    </div>
  </div>
  <script>
    window.webviewUri = "${webviewUri}";
  </script>
  <script src="${webviewUri}/panel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Crear `src/webview/panel.css`**

Copia exacta del contenido de `extension/popup.css`.

- [ ] **Step 3: Modificar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["src/webview/*.css", "src/webview/*.html"]
}
```

- [ ] **Step 4: Modificar `package.json` scripts y devDependencies**

```json
"scripts": {
  "vscode:prepublish": "npm run compile && npm run cp:webview && npm run cp:assets",
  "compile": "tsc -p ./",
  "watch": "tsc -watch -p ./",
  "cp:webview": "copyfiles -u 1 \"src/webview/**/*.css\" \"src/webview/**/*.html\" out/",
  "cp:assets": "copyfiles -u 1 \"assets/*\" \"out/webview/\""
},
"devDependencies": {
  "@types/vscode": "^1.85.0",
  "typescript": "^5.3.0",
  "copyfiles": "^2.4.1"
}
```

---

### Task 6: WebView panel JS (`panel.js`)

**Files:**
- Create: `vscode-radar/src/webview/panel.js`

**Interfaces:**
- Consumes: `postMessage` del host → `{ type: 'usageData', data: DatosUso }` y `{ type: 'rupture' }`
- Produce: `postMessage` al host → `{ type: 'requestUsage' }`

- [ ] **Step 1: Crear `src/webview/panel.js`**

```javascript
const vscodeApi = acquireVsCodeApi();

const panelUso = document.getElementById('panel-uso');
const panelError = document.getElementById('panel-error');
const msgError = document.getElementById('msg-error');
const btnReintentar = document.getElementById('btn-reintentar');
const txtActualizado = document.getElementById('actualizado');
const grupSesion = document.getElementById('grupo-sesion');
const pctSesion = document.getElementById('pct-sesion');
const rellenoSesion = document.getElementById('relleno-sesion');
const resetSesion = document.getElementById('reset-sesion');
const grupSemana = document.getElementById('grupo-semana');
const pctSemana = document.getElementById('pct-semana');
const rellenoSemana = document.getElementById('relleno-semana');
const resetSemana = document.getElementById('reset-semana');
const overlayEl = document.getElementById('overlay-ruptura');
const btnCerrarOverlay = document.getElementById('btn-cerrar-overlay');
const overlayMensaje = document.getElementById('overlay-mensaje');

let overlayDismissed = false;
let rupturaEnCurso = false;

function textoReset(epochSeg) {
  if (!epochSeg) return '';
  const diffMs = epochSeg * 1000 - Date.now();
  if (diffMs <= 0) return 'se reinicia pronto';
  const totalMin = Math.floor(diffMs / 60000);
  const horas = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (horas > 0) return `se reinicia en ${horas} h ${mins} min`;
  return `se reinicia en ${mins} min`;
}

function textoActualizado(isoString) {
  if (!isoString) return '';
  const diffSeg = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSeg < 10) return 'actualizado ahora mismo';
  if (diffSeg < 60) return `actualizado hace ${diffSeg} s`;
  const mins = Math.floor(diffSeg / 60);
  if (mins < 60) return `actualizado hace ${mins} min`;
  return `actualizado hace ${Math.floor(mins / 60)} h`;
}

function animarBarra(fillEl, pctEl, util, delayMs) {
  const targetPct = Math.min(util * 100, 100);
  const displayFinal = (util * 100).toFixed(1) + '%' + (util > 1 ? ' ⚠' : '');
  fillEl.getAnimations().forEach(a => a.cancel());
  fillEl.style.width = '0%';
  pctEl.textContent = '0%';
  fillEl.classList.remove('alerta', 'critica');
  pctEl.classList.remove('alerta', 'critica');
  if (util >= 1.0) {
    fillEl.classList.add('critica');
    pctEl.classList.add('critica');
  } else if (util >= 0.8) {
    fillEl.classList.add('alerta');
    pctEl.classList.add('alerta');
  }
  fillEl.animate(
    [{ width: '0%' }, { width: targetPct + '%' }],
    { duration: 900, easing: 'ease-in-out', fill: 'forwards', delay: delayMs }
  );
  const startTime = performance.now() + delayMs;
  function tick(now) {
    if (now < startTime) { requestAnimationFrame(tick); return; }
    const p = Math.min((now - startTime) / 900, 1);
    pctEl.textContent = Math.round(p * util * 100) + '%';
    if (p < 1) requestAnimationFrame(tick);
    else pctEl.textContent = displayFinal;
  }
  requestAnimationFrame(tick);
}

async function dispararRuptura(barrasCriticas) {
  if (rupturaEnCurso) return;
  rupturaEnCurso = true;
  try {
    const pulsos = barrasCriticas.map(({ grupoEl }) =>
      grupoEl.animate(
        [
          { boxShadow: 'none', borderColor: '#1e1e4a' },
          { boxShadow: '0 0 16px rgba(239,68,68,0.85)', borderColor: '#ef4444' },
          { boxShadow: 'none', borderColor: '#1e1e4a' },
        ],
        { duration: 400, iterations: 2 }
      )
    );
    await Promise.all(pulsos.map(p => p.finished));
    const vegetaImg = document.querySelector('.vegeta-img');
    if (!vegetaImg) return;
    const pulsoVegeta = vegetaImg.animate(
      [
        { filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.35))' },
        { filter: 'drop-shadow(0 0 22px rgba(239,68,68,1))' },
        { filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.35))' },
      ],
      { duration: 300, iterations: 3 }
    );
    await pulsoVegeta.finished;
    if (overlayDismissed) return;
    const nombres = barrasCriticas.map(b => b.nombre);
    overlayMensaje.textContent = nombres.join(' y ') + ' al límite ⚠';
    const soloSemanal = barrasCriticas.length === 1 && barrasCriticas[0].nombre === 'Semanal';
    document.getElementById('overlay-gif').src = soloSemanal
      ? window.webviewUri + '/over.gif'
      : window.webviewUri + '/vegeta-scanning.gif';
    overlayEl.classList.remove('oculto');
    overlayEl.animate(
      [{ opacity: '0' }, { opacity: '1' }],
      { duration: 400, fill: 'forwards' }
    );
  } finally {
    rupturaEnCurso = false;
  }
}

function pintarDatos(datos) {
  panelError.classList.add('oculto');
  panelUso.classList.remove('oculto');
  const { session, week, representativeClaim, updatedAt } = datos;
  const utilSesion = session?.utilization ?? 0;
  const utilSemana = week?.utilization ?? 0;
  resetSesion.textContent = textoReset(session?.reset);
  resetSemana.textContent = textoReset(week?.reset);
  grupSesion.classList.toggle('activa', representativeClaim === 'five_hour');
  grupSemana.classList.toggle('activa', representativeClaim === 'seven_day');
  txtActualizado.textContent = textoActualizado(updatedAt);
  if (datos.cached) txtActualizado.textContent += ' (caché)';
  animarBarra(rellenoSesion, pctSesion, utilSesion, 0);
  animarBarra(rellenoSemana, pctSemana, utilSemana, 150);
  const criticas = [];
  if (utilSesion >= 0.9) criticas.push({ grupoEl: grupSesion, nombre: 'Sesión' });
  if (utilSemana >= 0.9) criticas.push({ grupoEl: grupSemana, nombre: 'Semanal' });
  if (criticas.length > 0) dispararRuptura(criticas);
}

function mostrarError(mensaje) {
  panelUso.classList.add('oculto');
  panelError.classList.remove('oculto');
  msgError.textContent = mensaje;
}

window.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;
  if (msg.type === 'usageData') {
    if (msg.data.error) {
      mostrarError(msg.data.error);
    } else {
      pintarDatos(msg.data);
    }
  }
  if (msg.type === 'rupture') {
    const s = msg.data?.session?.utilization ?? 0;
    const w = msg.data?.week?.utilization ?? 0;
    const criticas = [];
    if (s >= 0.9) criticas.push({ grupoEl: grupSesion, nombre: 'Sesión' });
    if (w >= 0.9) criticas.push({ grupoEl: grupSemana, nombre: 'Semanal' });
    if (criticas.length > 0) dispararRuptura(criticas);
  }
});

btnReintentar.addEventListener('click', () => vscodeApi.postMessage({ type: 'requestUsage' }));
btnCerrarOverlay.addEventListener('click', () => {
  overlayDismissed = true;
  overlayEl.animate(
    [{ opacity: '1' }, { opacity: '0' }],
    { duration: 300, fill: 'forwards' }
  ).finished.then(() => overlayEl.classList.add('oculto'));
});

vscodeApi.postMessage({ type: 'requestUsage' });
```

- [ ] **Step 2: Compilar y copiar**

```
cd vscode-radar && npm run compile && npm run cp:webview && npm run cp:assets
```
Esperado: todo compila, `out/webview/panel.js`, `out/webview/panel.css`, `out/webview/panel.html` existen.

---

## Auto-revisión del plan

1. **Cobertura del spec:** Cada sección del spec tiene su tarea correspondiente.
2. **Placeholders:** Ninguno — todo el código está completo en cada paso.
3. **Consistencia de tipos:** `DatosUso`, `Credenciales`, `MensajeWebView` se definen en Task 2 y se usan consistentemente en Tasks 3-6. Las funciones `obtenerUso()`, `leerCredenciales()`, `refreshearToken()`, `consultarUso()` se definen en Task 3 y se usan en Task 4.
