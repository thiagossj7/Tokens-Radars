// Endpoint del servidor local
const URL_USO = 'http://localhost:37123/usage';
const URL_FORZAR = 'http://localhost:37123/usage?force=true';

// Referencias al DOM
const panelUso    = document.getElementById('panel-uso');
const panelError  = document.getElementById('panel-error');
const msgError    = document.getElementById('msg-error');
const btnActualizar = document.getElementById('btn-actualizar');
const iconoBtn    = document.getElementById('icono-btn');
const txtActualizado = document.getElementById('actualizado');

// Elementos de la barra Sesión
const grupSesion   = document.getElementById('grupo-sesion');
const pctSesion    = document.getElementById('pct-sesion');
const rellenoSesion = document.getElementById('relleno-sesion');
const resetSesion  = document.getElementById('reset-sesion');

// Elementos de la barra Semanal
const grupSemana    = document.getElementById('grupo-semana');
const pctSemana     = document.getElementById('pct-semana');
const rellenoSemana = document.getElementById('relleno-semana');
const resetSemana   = document.getElementById('reset-semana');

// Overlay de ruptura
const overlayEl         = document.getElementById('overlay-ruptura');
const btnCerrarOverlay  = document.getElementById('btn-cerrar-overlay');
const overlayMensaje    = document.getElementById('overlay-mensaje');

// Guarda si el usuario cerró el overlay con ✕ en esta apertura del popup
let overlayDismissed = false;
// Evita que dispararRuptura corra en paralelo si el usuario actualiza mientras anima
let rupturaEnCurso = false;

// Persiste en localStorage el umbral de ruptura mostrado (0, 0.9, 1.0) entre aperturas
const STORAGE_UMBRAL = 'rdt_umbral_mostrado';
function getUmbralMostrado() {
  return parseFloat(localStorage.getItem(STORAGE_UMBRAL) || '0');
}
function setUmbralMostrado(val) {
  localStorage.setItem(STORAGE_UMBRAL, String(val));
}
function clearUmbralMostrado() {
  localStorage.removeItem(STORAGE_UMBRAL);
}

// Calcula el texto "se reinicia en X h Y min" a partir de un epoch en segundos
function textoReset(epochSeg) {
  if (!epochSeg) return '';
  const diffMs = epochSeg * 1000 - Date.now();
  if (diffMs <= 0) return 'se reinicia pronto';

  const totalMin = Math.floor(diffMs / 60000);
  const horas = Math.floor(totalMin / 60);
  const mins  = totalMin % 60;

  if (horas > 0) return `se reinicia en ${horas} h ${mins} min`;
  return `se reinicia en ${mins} min`;
}

// Calcula "actualizado hace X" a partir de un ISO string
function textoActualizado(isoString) {
  if (!isoString) return '';
  const diffSeg = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSeg < 10)  return 'actualizado ahora mismo';
  if (diffSeg < 60)  return `actualizado hace ${diffSeg} s`;
  const mins = Math.floor(diffSeg / 60);
  if (mins < 60)     return `actualizado hace ${mins} min`;
  const horas = Math.floor(mins / 60);
  return `actualizado hace ${horas} h`;
}

// Anima una barra desde 0% hasta su valor real usando Web Animations API.
// Corre un contador visual en paralelo con requestAnimationFrame.
function animarBarra(fillEl, pctEl, util, delayMs) {
  const targetPct  = Math.min(util * 100, 100);
  const capped = Math.min(util, 1);
  const displayFinal = (capped * 100).toFixed(1) + '%' + (util > 1 ? ' ⚠' : '');

  // Cancelar animación previa para que fill:'forwards' no bloquee el reset
  fillEl.getAnimations().forEach(a => a.cancel());
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
    pctEl.textContent = Math.round(p * capped * 100) + '%';
    if (p < 1) requestAnimationFrame(tick);
    else pctEl.textContent = displayFinal;
  }
  requestAnimationFrame(tick);
}

// Secuencia de ruptura encadenada con await .finished (sin setTimeout).
// barrasCriticas: array de { grupoEl, nombre } para las barras que superaron el 90%.
async function dispararRuptura(barrasCriticas) {
  if (rupturaEnCurso) return;
  rupturaEnCurso = true;
  try {
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
  if (!vegetaImg) return;
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

  // GIF según qué barra disparó: semanal → over.gif, sesión → vegeta-scanning.gif
  const soloSemanal = barrasCriticas.length === 1 && barrasCriticas[0].nombre === 'Semanal';
  document.getElementById('overlay-gif').src = soloSemanal
    ? 'images/over.gif'
    : 'images/vegeta-scanning.gif';

  overlayEl.classList.remove('oculto');
  overlayEl.animate(
    [{ opacity: '0' }, { opacity: '1' }],
    { duration: 400, fill: 'forwards' }
  );

  } finally {
    rupturaEnCurso = false;
  }
}

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

  // Umbral-based rupture: show once at 90%, once at 100%
  const maxUtil = Math.max(utilSesion, utilSemana);
  const umbralActual = getUmbralMostrado();

  if (maxUtil < 0.9) {
    clearUmbralMostrado();
  }

  const criticas = [];
  if (utilSesion >= 0.9) criticas.push({ grupoEl: grupSesion, nombre: 'Sesión' });
  if (utilSemana >= 0.9) criticas.push({ grupoEl: grupSemana, nombre: 'Semanal' });

  const nuevoUmbral = maxUtil >= 1.0 ? 1.0 : maxUtil >= 0.9 ? 0.9 : 0;
  if (nuevoUmbral > umbralActual && criticas.length > 0) {
    setUmbralMostrado(nuevoUmbral);
    dispararRuptura(criticas);
  }
}

// Muestra un mensaje de error en el panel de error
function mostrarError(mensaje) {
  panelUso.classList.add('oculto');
  panelError.classList.remove('oculto');

  // Mensajes de ayuda según el tipo de error
  if (mensaje.includes('fetch') || mensaje.includes('Failed') || mensaje.includes('NetworkError')) {
    msgError.textContent = 'No se puede conectar con el servidor. Ábrelo con:\ncd server && npm start';
  } else {
    msgError.textContent = mensaje;
  }
}

// Llama al servidor y actualiza la UI. Si forzar=true llama con ?force=true
async function cargarUso(forzar = false) {
  btnActualizar.disabled = true;
  iconoBtn.classList.add('girando');

  try {
    const url = forzar ? URL_FORZAR : URL_USO;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const datos = await resp.json();

    if (datos.error) {
      mostrarError(datos.error);
    } else {
      pintarDatos(datos);
    }
  } catch (err) {
    mostrarError(err.message);
  } finally {
    btnActualizar.disabled = false;
    iconoBtn.classList.remove('girando');
  }
}

// Al abrir el popup: una sola consulta normal (puede usar la caché del servidor)
cargarUso(false);

// Botón Actualizar: fuerza una lectura nueva
btnActualizar.addEventListener('click', () => cargarUso(true));

// Botón ✕ del overlay: lo cierra con fade-out y no vuelve a aparecer en esta sesión
btnCerrarOverlay.addEventListener('click', () => {
  overlayDismissed = true;
  overlayEl.animate(
    [{ opacity: '1' }, { opacity: '0' }],
    { duration: 300, fill: 'forwards' }
  ).finished.then(() => overlayEl.classList.add('oculto'));
});
