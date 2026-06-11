// AVISO: Las cabeceras anthropic-ratelimit-unified-* NO son oficiales.
// Fueron descubiertas por ingeniería inversa del protocolo OAuth de Claude Code.
// Pueden cambiar o dejar de funcionar sin previo aviso.
// Referencia: https://github.com/nsanden/claude-rate-monitor

const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const app = express();
const PORT = 37123;

// CORS para que la extensión pueda consumir el endpoint
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Caché en memoria: guarda la última respuesta y cuándo se obtuvo
let cache = {
  data: null,
  timestamp: 0,
};
const CACHE_TTL_MS = 60 * 1000; // 60 segundos

// Rutas donde Claude Code guarda las credenciales OAuth
function leerToken() {
  const rutas = [
    path.join(os.homedir(), '.claude', '.credentials.json'),
    path.join(os.homedir(), '.config', 'claude', '.credentials.json'),
  ];

  for (const ruta of rutas) {
    try {
      const contenido = fs.readFileSync(ruta, 'utf8');
      const json = JSON.parse(contenido);
      const token = json?.claudeAiOauth?.accessToken;
      if (token) return token;
    } catch {
      // Archivo no existe o no tiene la forma esperada; probar la siguiente ruta
    }
  }

  return null;
}

// Hace la petición mínima a la API de Anthropic para obtener las cabeceras de uso.
// El token NUNCA se devuelve al frontend ni se escribe en logs.
function consultarUso(token) {
  return new Promise((resolve, reject) => {
    const cuerpo = JSON.stringify({
      model: 'claude-haiku-4-5-20251001', // Haiku funciona con token OAuth; Sonnet/Opus pueden devolver 400
      max_tokens: 1,
      messages: [{ role: 'user', content: 'hi' }],
    });

    const opciones = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        // El token solo sale hacia api.anthropic.com, nunca hacia otro destino
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'oauth-2025-04-20',
        'Content-Length': Buffer.byteLength(cuerpo),
      },
    };

    const req = https.request(opciones, (res) => {
      const h = res.headers;

      // Leer las cabeceras de uso unificado
      const sessionUtil = parseFloat(h['anthropic-ratelimit-unified-5h-utilization'] ?? '0');
      const sessionReset = parseInt(h['anthropic-ratelimit-unified-5h-reset'] ?? '0', 10);
      const sessionStatus = h['anthropic-ratelimit-unified-5h-status'] ?? 'active';

      const weekUtil = parseFloat(h['anthropic-ratelimit-unified-7d-utilization'] ?? '0');
      const weekReset = parseInt(h['anthropic-ratelimit-unified-7d-reset'] ?? '0', 10);
      const weekStatus = h['anthropic-ratelimit-unified-7d-status'] ?? 'active';

      const representativeClaim = h['anthropic-ratelimit-unified-representative-claim'] ?? null;
      const overage = h['anthropic-ratelimit-unified-overage-status'] ?? null;

      if (res.statusCode === 401) {
        res.resume();
        reject(new Error('Tu sesión de Claude Code expiró. Abre una terminal y corre `claude` para renovar el token, luego reinicia el servidor.'));
        return;
      }

      if (res.statusCode === 400) {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          reject(new Error(`Error 400 de la API: ${body}`));
        });
        return;
      }

      // Consumir el body para que la conexión se cierre limpiamente
      res.resume();

      resolve({
        session: { utilization: sessionUtil, reset: sessionReset, status: sessionStatus },
        week: { utilization: weekUtil, reset: weekReset, status: weekStatus },
        representativeClaim,
        overage: overage === 'null' ? null : overage,
      });
    });

    req.on('error', reject);
    req.write(cuerpo);
    req.end();
  });
}

app.get('/usage', async (req, res) => {
  const forzar = req.query.force === 'true';
  const ahora = Date.now();

  // Devolver caché si es reciente y no se pide lectura forzada
  if (!forzar && cache.data && ahora - cache.timestamp < CACHE_TTL_MS) {
    return res.json({ ...cache.data, cached: true });
  }

  const token = leerToken();

  if (!token) {
    return res.json({
      session: null,
      week: null,
      representativeClaim: null,
      overage: null,
      updatedAt: new Date().toISOString(),
      cached: false,
      error: 'No se encontró un token de Claude Code válido. Inicia sesión corriendo `claude` en la terminal.',
    });
  }

  try {
    const datos = await consultarUso(token);
    const respuesta = {
      ...datos,
      updatedAt: new Date().toISOString(),
      cached: false,
      error: null,
    };

    cache.data = respuesta;
    cache.timestamp = ahora;

    return res.json(respuesta);
  } catch (err) {
    return res.json({
      session: null,
      week: null,
      representativeClaim: null,
      overage: null,
      updatedAt: new Date().toISOString(),
      cached: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de uso en http://localhost:${PORT} — deja esta ventana abierta.`);
});
