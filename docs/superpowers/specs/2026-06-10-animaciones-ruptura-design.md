# Diseño: Animaciones y efecto de ruptura al 90%

**Fecha:** 2026-06-10
**Proyecto:** Radar de Tokens — Vegeta (extensión Chrome)
**Alcance:** Añadir animaciones de barras al abrir el popup y efecto de ruptura cuando una barra llega al 90%+

---

## Resumen

Dos comportamientos nuevos en el popup de la extensión:

1. **Al abrir el popup:** las barras de sesión y semanal animan desde 0% hasta su valor real.
2. **Al llegar al 90%+:** cada barra dispara de forma independiente una secuencia de efectos (flash rojo, icono pulsando) que termina con un overlay de pantalla completa mostrando `vegeta-scanning.gif`. El overlay se cierra con un botón ✕.

---

## Decisiones de diseño

| Decisión | Elección | Motivo |
|---|---|---|
| API de animación | Web Animations API (`element.animate()`) | Permite encadenar animaciones con `.finished` en vez de `setTimeout`, control de estado y sin dependencias externas |
| Velocidad de barras | 900 ms, `ease-in-out` | Sensación suave y moderna, sin ser lenta |
| Desfase entre barras | 150 ms | Evita que las dos barras sean idénticas y se lean como una sola |
| Trigger de ruptura | ≥ 90% de utilización por barra | Independiente para sesión y semanal |
| Posición del GIF | Overlay de pantalla completa sobre el popup | Más impacto visual |
| Efecto previo al overlay | Flash rojo en la barra → pulso del icono del radar | Estilo B (elegido en brainstorming) |
| Cierre del overlay | Botón ✕ con fade-out | El usuario decide cuándo quitarlo |
| Reaparición del overlay | Solo al reabrir el popup (variable `overlayDismissed`) | No interrumpe si el usuario ya lo vio y lo cerró en la misma sesión |

---

## Flujo de animación de barras

Al recibir datos del servidor (`pintarDatos()`):

```
para cada barra (sesión, semanal):
  1. Establecer width = 0% sin transición (reset visual)
  2. element.animate([{width:'0%'}, {width: target+'%'}], {duration:900, easing:'ease-in-out', fill:'forwards'})
  3. En paralelo: contador requestAnimationFrame que incrementa el texto del % de 0 a target
  4. La barra semanal arranca con 150 ms de retraso respecto a la de sesión
```

---

## Flujo del efecto de ruptura

Se evalúa en `pintarDatos()` después de animar las barras. Si `utilización ≥ 0.9`:

```
1. barraRelleno.animate(keyframes de pulso rojo, {duration:400, iterations:2})
   → await .finished
2. iconoRadar.animate(keyframes de pulso rojo, {duration:300, iterations:3})
   → await .finished
3. Si overlayDismissed === false:
     overlayEl.classList.remove('oculto')
     overlayEl.animate([{opacity:0},{opacity:1}], {duration:400, fill:'forwards'})
```

Si ambas barras están ≥ 90% simultáneamente, el overlay se muestra **una sola vez** (la primera que llegue lo activa; la segunda comprueba si ya está visible).

---

## Estructura del overlay (popup.html)

```html
<div id="overlay-ruptura" class="oculto">
  <button id="btn-cerrar-overlay">✕</button>
  <img src="images/vegeta-scanning.gif" alt="Vegeta escaneando" />
  <p id="overlay-mensaje"><!-- "Sesión al 92% ⚠" o "Sesión y Semanal al límite ⚠" --></p>
</div>
```

El texto del overlay se genera dinámicamente según qué barra(s) superen el 90%.

---

## Cambios por archivo

### `popup.html`
- Añadir `<div id="overlay-ruptura">` con el GIF, el mensaje y el botón ✕.
- Copiar `vegeta-scanning.gif` a `extension/images/`.

### `popup.css`
- Añadir estilos del overlay: `position:fixed; inset:0; background:rgba(0,0,0,.92); z-index:100`.
- Añadir estilos del botón ✕: esquina superior derecha, color rojo tenue.
- Añadir clase `.critica-glow` para el estado visual de barra al 90%+ (borde rojo).
- Eliminar las reglas `transition:` de `.barra-relleno` (la Web Animations API las reemplaza).

### `popup.js`
- Eliminar función `aplicarColor()` y reemplazar por lógica que usa `element.animate()`.
- Añadir `animarBarra(fillEl, pctEl, target, delayMs)` — encapsula la animación + contador.
- Añadir `dispararRuptura(barras)` — función `async` que encadena pulso → icono → overlay con `await .finished`.
- Añadir variable `overlayDismissed = false` al inicio.
- Añadir listener al botón ✕ que hace fade-out del overlay y pone `overlayDismissed = true`.

---

## Archivos fuera de scope

- `server.js` — sin cambios.
- `manifest.json` — sin cambios.
- `popup.html` estructura general — sin cambios, solo se añade el overlay.

---

## Criterios de éxito

- [ ] Al abrir el popup las barras animan suavemente desde 0% con contador visible.
- [ ] Cuando sesión ≥ 90%: barra pulsa roja → icono pulsa → overlay aparece con el GIF.
- [ ] Cuando semanal ≥ 90%: mismo efecto independiente.
- [ ] Si las dos están ≥ 90%, el overlay aparece una sola vez.
- [ ] El botón ✕ cierra el overlay con fade-out.
- [ ] Al cerrar con ✕ y pulsar ↻ Actualizar, el overlay no reaparece (si sigue ≥ 90%).
- [ ] Al cerrar el popup y reabrirlo, el overlay sí vuelve a aparecer si sigue ≥ 90%.
- [ ] No hay `setTimeout` para encadenar animaciones.
