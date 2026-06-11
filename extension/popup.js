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
const grupSemana   = document.getElementById('grupo-semana');
const pctSemana    = document.getElementById('pct-semana');
const rellenoSemana = document.getElementById('relleno-semana');
const resetSemana  = document.getElementById('reset-semana');

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
