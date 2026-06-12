# Animaciones y efecto de ruptura al 90% — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir animación de barras al abrir el popup y un efecto de "ruptura" con overlay GIF cuando una barra llega al 90%+.

**Architecture:** Se usan la Web Animations API (`element.animate()`) y cadenas `await .finished` en lugar de `setTimeout`. La lógica de animaciones y ruptura vive enteramente en `popup.js`; los estilos del overlay van en `popup.css`; el HTML del overlay se inserta en `popup.html`. No se crean archivos nuevos.

**Tech Stack:** JavaScript (Web Animations API, `requestAnimationFrame`), CSS, HTML — sin dependencias externas. Extensión Chrome Manifest V3.

---

## Mapa de archivos

| Archivo | Acción | Qué cambia |
|---|---|---|
| `extension/images/vegeta-scanning.gif` | Copiar | GIF fuente desde la raíz del repo |
| `extension/popup.html` | Modificar | Añadir `<div id="overlay-ruptura">` con GIF, mensaje y botón ✕ |
| `extension/popup.css` | Modificar | Añadir estilos del overlay y botón ✕; eliminar `transition:` de `.barra-relleno` |
| `extension/popup.js` | Modificar | Añadir `animarBarra()`, `dispararRuptura()`; refactorizar `pintarDatos()`; eliminar `aplicarColor()` |

---

## Task 1: Copiar el GIF y actualizar popup.html

**Files:**
- Copy: `vegeta-scanning.gif` → `extension/images/vegeta-scanning.gif`
- Modify: `extension/popup.html`

- [ ] **Step 1.1: Copiar el GIF**

```powershell
Copy-Item "C:\Users\Santiago\Desktop\Radar\vegeta-scanning.gif" "C:\Users\Santiago\Desktop\Radar\radar-vegeta-tokens\extension\images\vegeta-scanning.gif"
```

Verificar que existe:
```powershell
Test-Path "C:\Users\Santiago\Desktop\Radar\radar-vegeta-tokens\extension\images\vegeta-scanning.gif"
```
Esperado: `True`

- [ ] **Step 1.2: Añadir el overlay al final de `popup.html`, justo antes de `<script src="popup.js"></script>`**

Localizar esta línea en `extension/popup.html`:
```html
  <script src="popup.js"></script>
```

Reemplazarla por:
```html
    <!-- Overlay de ruptura: aparece cuando una barra llega al 90%+ -->
    <div id="overlay-ruptura" class="oculto">
      <button id="btn-cerrar-overlay" title="Cerrar">✕</button>
      <img src="images/vegeta-scanning.gif" alt="Vegeta escaneando" />
      <p id="overlay-mensaje"></p>
    </div>

  <script src="popup.js"></script>
```

- [ ] **Step 1.3: Commit**

```bash
git add extension/images/vegeta-scanning.gif extension/popup.html
git commit -m "feat: añadir overlay de ruptura al HTML y copiar GIF"
```

---

## Task 2: Actualizar popup.css

**Files:**
- Modify: `extension/popup.css`

- [ ] **Step 2.1: Eliminar la propiedad `transition:` de `.barra-relleno`**

La Web Animations API reemplaza la transición CSS. Localizar en `popup.css`:

```css
.barra-relleno {
  height: 100%;
  width: 0%;
  border-radius: 4px;
  background: var(--azul);
  box-shadow: 0 0 6px var(--azul-glow);
  transition: width 0.5s ease, background-color 0.3s;
}
```

Reemplazar por (sin `transition:`):

```css
.barra-relleno {
  height: 100%;
  width: 0%;
  border-radius: 4px;
  background: var(--azul);
  box-shadow: 0 0 6px var(--azul-glow);
}
```

- [ ] **Step 2.2: Añadir estilos del overlay y botón ✕ al final de `popup.css`, antes del comentario `/* ── Utilidad ──`**

Localizar en `popup.css`:
```css
/* ── Utilidad ───────────────────────────────────────── */
```

Insertar justo antes:
```css
/* ── Overlay de ruptura ─────────────────────────────── */
#overlay-ruptura {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.92);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border-radius: 0;
}

#overlay-ruptura img {
  width: 160px;
  height: auto;
  border-radius: 8px;
  border: 2px solid var(--rojo);
  box-shadow: 0 0 20px var(--rojo-glow);
}

#overlay-mensaje {
  font-size: 13px;
  font-weight: 700;
  color: #fca5a5;
  text-align: center;
  padding: 0 16px;
  line-height: 1.5;
}

#btn-cerrar-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: 1px solid #4a1a1a;
  color: #fca5a5;
  font-size: 14px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, color 0.2s;
}

#btn-cerrar-overlay:hover {
  border-color: var(--rojo);
  color: var(--rojo);
}

```

- [ ] **Step 2.3: Commit**

```bash
git add extension/popup.css
git commit -m "feat: estilos del overlay de ruptura y quitar transition CSS de barras"
```

---

## Task 3: Refactorizar popup.js con Web Animations API

**Files:**
- Modify: `extension/popup.js`

Este task reemplaza por completo el contenido de `popup.js`. El archivo final tiene las mismas responsabilidades que antes más las nuevas funciones de animación.

- [ ] **Step 3.1: Añadir referencias DOM del overlay al bloque de referencias existente**

Localizar en `popup.js`:
```js
// Elementos de la barra Semanal
const grupSemana   = document.getElementById('grupo-semana');
const pctSemana    = document.getElementById('pct-semana');
const rellenoSemana = document.getElementById('relleno-semana');
const resetSemana  = document.getElementById('reset-semana');
```

Reemplazar por:
```js
// Elementos de la barra Semanal
const grupSemana    = document.getElementById('grupo-semana');
const pctSemana     = document.getElementById('pct-semana');
const rellenoSemana = document.getElementById('relleno-semana');
const resetSemana   = document.getElementById('reset-semana');

// Overlay de ruptura
const overlayEl         = document.getElementById('overlay-ruptura');
const btnCerrarOverlay  = document.getElementById('btn-cerrar-overlay');
const overlayMensaje    = document.getElementById('overlay-mensaje');
```

- [ ] **Step 3.2: Añadir variable `overlayDismissed` justo después de las referencias DOM**

Localizar en `popup.js`:
```js
// Calcula el texto "se reinicia en X h Y min" a partir de un epoch en segundos
```

Insertar justo antes:
```js
// Guarda si el usuario cerró el overlay con ✕ en esta apertura del popup
let overlayDismissed = false;

```

- [ ] **Step 3.3: Eliminar la función `aplicarColor` completa**

Localizar y eliminar este bloque entero de `popup.js`:
```js
// Aplica el color correcto a porcentaje y relleno según el valor
function aplicarColor(pctEl, rellenoEl, valor) {
  // Limpiar clases previas
  pctEl.classList.remove('alerta', 'critica');
  rellenoEl.classList.remove('alerta', 'critica');

  if (valor >= 1.0) {
    pctEl.classList.add('critica');
    rellenoEl.classList.add('critica');
  } else if (valor >= 0.8) {
    pctEl.classList.add('alerta');
    rellenoEl.classList.add('alerta');
  }
}
```

- [ ] **Step 3.4: Añadir función `animarBarra` en el lugar donde estaba `aplicarColor`**

En el mismo lugar donde estaba `aplicarColor`, insertar:

```js
// Anima una barra desde 0% hasta su valor real usando Web Animations API.
// Corre un contador visual en paralelo con requestAnimationFrame.
function animarBarra(fillEl, pctEl, util, delayMs) {
  const targetPct  = Math.min(util * 100, 100);
  const displayFinal = (util * 100).toFixed(1) + '%' + (util > 1 ? ' ⚠' : '');

  // Reset sin animación
  fillEl.style.width = '0%';
  pctEl.textContent  = '0%';

  // Clases de color según umbral
  fillEl.classList.remove('alerta', 'critica');
  pctEl.classList.remove('alerta', 'critica');
  if (util >= 1.0) {
    fillEl.classList.add('critica');
    pctEl.classList.add('critica');
  } else if (util >= 0.8) {
    fillEl.classList.add('alerta');
    pctEl.classList.add('alerta');
  }

  // Animación de la barra (Web Animations API)
  fillEl.animate(
    [{ width: '0%' }, { width: targetPct + '%' }],
    { duration: 900, easing: 'ease-in-out', fill: 'forwards', delay: delayMs }
  );

  // Contador visual del porcentaje en paralelo
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
```

- [ ] **Step 3.5: Añadir función `dispararRuptura` justo después de `animarBarra`**

```js
// Secuencia de ruptura encadenada con await .finished (sin setTimeout).
// barrasCriticas: array de { grupoEl, nombre } para las barras que superaron el 90%.
async function dispararRuptura(barrasCriticas) {
  // 1. Flash rojo en el borde del grupo de cada barra crítica
  const pulsos = barrasCriticas.map(({ grupoEl }) =>
    grupoEl.animate(
      [
        { boxShadow: 'none',                            borderColor: '#1e1e4a' },
        { boxShadow: '0 0 16px rgba(239,68,68,0.85)',   borderColor: '#ef4444' },
        { boxShadow: 'none',                            borderColor: '#1e1e4a' },
      ],
      { duration: 400, iterations: 2 }
    )
  );
  await Promise.all(pulsos.map(p => p.finished));

  // 2. La imagen de Vegeta pulsa en rojo
  const vegetaImg = document.querySelector('.vegeta-img');
  const pulsoVegeta = vegetaImg.animate(
    [
      { filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.35))' },
      { filter: 'drop-shadow(0 0 22px rgba(239,68,68,1))'     },
      { filter: 'drop-shadow(0 0 12px rgba(59,130,246,0.35))' },
    ],
    { duration: 300, iterations: 3 }
  );
  await pulsoVegeta.finished;

  // 3. Mostrar overlay (solo si el usuario no lo cerró ya en esta sesión)
  if (overlayDismissed) return;

  const nombres = barrasCriticas.map(b => b.nombre);
  overlayMensaje.textContent = nombres.join(' y ') + ' al límite ⚠';

  overlayEl.classList.remove('oculto');
  overlayEl.animate(
    [{ opacity: '0' }, { opacity: '1' }],
    { duration: 400, fill: 'forwards' }
  );
}
```

- [ ] **Step 3.6: Reemplazar `pintarDatos` para usar las nuevas funciones**

Localizar el bloque completo de `pintarDatos` en `popup.js`:
```js
// Pinta ambas barras con los datos recibidos
function pintarDatos(datos) {
  panelError.classList.add('oculto');
  panelUso.classList.remove('oculto');

  const { session, week, representativeClaim, overage, updatedAt } = datos;

  // ── Sesión ──────────────────────────────────────────
  const utilSesion = session?.utilization ?? 0;
  const pctTextoSesion = (utilSesion * 100).toFixed(1) + '%';
  pctSesion.textContent = utilSesion > 1
    ? pctTextoSesion + ' ⚠'
    : pctTextoSesion;
  rellenoSesion.style.width = Math.min(utilSesion * 100, 100) + '%';
  aplicarColor(pctSesion, rellenoSesion, utilSesion);
  resetSesion.textContent = textoReset(session?.reset);

  // ── Semanal ─────────────────────────────────────────
  const utilSemana = week?.utilization ?? 0;
  const pctTextoSemana = (utilSemana * 100).toFixed(1) + '%';
  pctSemana.textContent = utilSemana > 1
    ? pctTextoSemana + ' ⚠'
    : pctTextoSemana;
  rellenoSemana.style.width = Math.min(utilSemana * 100, 100) + '%';
  aplicarColor(pctSemana, rellenoSemana, utilSemana);
  resetSemana.textContent = textoReset(week?.reset);

  // ── Resaltar la barra que actualmente limita ─────────
  grupSesion.classList.toggle('activa', representativeClaim === 'five_hour');
  grupSemana.classList.toggle('activa', representativeClaim === 'seven_day');

  // ── Timestamp ────────────────────────────────────────
  txtActualizado.textContent = textoActualizado(updatedAt);
  if (datos.cached) {
    txtActualizado.textContent += ' (caché)';
  }
}
```

Reemplazar por:
```js
// Pinta ambas barras con los datos recibidos
function pintarDatos(datos) {
  panelError.classList.add('oculto');
  panelUso.classList.remove('oculto');

  const { session, week, representativeClaim, updatedAt } = datos;

  const utilSesion = session?.utilization ?? 0;
  const utilSemana = week?.utilization ?? 0;

  // Textos de reset y representative claim
  resetSesion.textContent = textoReset(session?.reset);
  resetSemana.textContent = textoReset(week?.reset);
  grupSesion.classList.toggle('activa', representativeClaim === 'five_hour');
  grupSemana.classList.toggle('activa', representativeClaim === 'seven_day');

  // Timestamp
  txtActualizado.textContent = textoActualizado(updatedAt);
  if (datos.cached) txtActualizado.textContent += ' (caché)';

  // Animar barras con Web Animations API (semanal con 150 ms de desfase)
  animarBarra(rellenoSesion, pctSesion, utilSesion, 0);
  animarBarra(rellenoSemana, pctSemana, utilSemana, 150);

  // Detectar barras que superan el 90% y disparar ruptura
  const criticas = [];
  if (utilSesion >= 0.9) criticas.push({ grupoEl: grupSesion, nombre: 'Sesión' });
  if (utilSemana >= 0.9) criticas.push({ grupoEl: grupSemana, nombre: 'Semanal' });
  if (criticas.length > 0) dispararRuptura(criticas);
}
```

- [ ] **Step 3.7: Añadir listener del botón ✕ al final de `popup.js`**

Localizar al final de `popup.js`:
```js
// Botón Actualizar: fuerza una lectura nueva
btnActualizar.addEventListener('click', () => cargarUso(true));
```

Añadir justo después:
```js
// Botón ✕ del overlay: lo cierra con fade-out y no vuelve a aparecer en esta sesión
btnCerrarOverlay.addEventListener('click', () => {
  overlayDismissed = true;
  overlayEl.animate(
    [{ opacity: '1' }, { opacity: '0' }],
    { duration: 300, fill: 'forwards' }
  ).finished.then(() => overlayEl.classList.add('oculto'));
});
```

- [ ] **Step 3.8: Commit**

```bash
git add extension/popup.js
git commit -m "feat: Web Animations API para barras y efecto de ruptura al 90%"
```

---

## Task 4: Verificación manual en Chrome

No hay framework de tests para extensiones Chrome. La verificación es manual.

- [ ] **Step 4.1: Recargar la extensión**

1. Abre `chrome://extensions`
2. Busca "Radar de Tokens — Vegeta"
3. Pulsa el botón **↻** (recargar extensión)

- [ ] **Step 4.2: Verificar animación de barras**

1. Pulsa el icono del radar en Chrome para abrir el popup
2. Verificar: las barras empiezan en 0% y suben suavemente hasta su valor real (~0.9 s)
3. Verificar: el contador numérico sube en paralelo con la barra
4. Verificar: la barra de sesión empieza antes que la semanal (~150 ms de diferencia visible)

- [ ] **Step 4.3: Verificar efecto de ruptura (simulando 90%)**

Para probar sin esperar a tener 90% real, abre DevTools en el popup (clic derecho → Inspeccionar en el popup) y ejecuta en la consola:

```js
// Simular datos al 91%
pintarDatos({
  session:  { utilization: 0.91, reset: Math.floor(Date.now()/1000) + 7200, status: 'warning' },
  week:     { utilization: 0.45, reset: Math.floor(Date.now()/1000) + 86400, status: 'active' },
  representativeClaim: 'five_hour',
  overage: null,
  updatedAt: new Date().toISOString(),
  cached: false,
  error: null
});
```

Verificar:
- El borde del grupo "Sesión" pulsa en rojo (2 veces)
- La imagen de Vegeta pulsa en rojo (3 veces)
- Aparece el overlay con el GIF de vegeta-scanning.gif y el mensaje "Sesión al límite ⚠"
- El botón ✕ está visible en la esquina superior derecha

- [ ] **Step 4.4: Verificar cierre del overlay**

1. Pulsar el botón ✕
2. Verificar: el overlay hace fade-out y desaparece
3. Ejecutar en consola el mismo comando del Step 4.3
4. Verificar: las barras animan pero el overlay **no** reaparece (overlayDismissed=true)

- [ ] **Step 4.5: Verificar ambas barras al 90%**

```js
pintarDatos({
  session:  { utilization: 0.92, reset: Math.floor(Date.now()/1000) + 7200, status: 'warning' },
  week:     { utilization: 0.95, reset: Math.floor(Date.now()/1000) + 86400, status: 'warning' },
  representativeClaim: 'five_hour',
  overage: null,
  updatedAt: new Date().toISOString(),
  cached: false,
  error: null
});
```

Verificar:
- Ambos grupos pulsan en rojo
- El mensaje del overlay dice "Sesión y Semanal al límite ⚠"
- El overlay aparece una sola vez (no dos)

- [ ] **Step 4.6: Commit final**

```bash
git add -A
git commit -m "chore: verificación manual completada — animaciones y ruptura funcionando"
git push
```
