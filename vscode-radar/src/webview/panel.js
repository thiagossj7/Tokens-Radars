const vscodeApi = acquireVsCodeApi();

const panelUso = document.getElementById('panel-uso');
const panelError = document.getElementById('panel-error');
const msgError = document.getElementById('msg-error');
const btnActualizar = document.getElementById('btn-actualizar');
const iconoBtn = document.getElementById('icono-btn');
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
      ? window.overGifUri
      : window.scanGifUri;
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
  iconoBtn.classList.remove('girando');
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
  iconoBtn.classList.remove('girando');
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

btnActualizar.addEventListener('click', () => {
  iconoBtn.classList.add('girando');
  vscodeApi.postMessage({ type: 'requestUsage' });
});

btnCerrarOverlay.addEventListener('click', () => {
  overlayDismissed = true;
  overlayEl.animate(
    [{ opacity: '1' }, { opacity: '0' }],
    { duration: 300, fill: 'forwards' }
  ).finished.then(() => overlayEl.classList.add('oculto'));
});

vscodeApi.postMessage({ type: 'requestUsage' });
