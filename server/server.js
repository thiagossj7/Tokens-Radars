const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');

const app = express();
const PORT = 37123;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

let cache = { data: null, timestamp: 0 };
const CACHE_TTL_MS = 60 * 1000;

class ErrorAutenticacion extends Error {
  constructor() { super('TOKEN_EXPIRADO'); this.name = 'ErrorAutenticacion'; }
}

function leerCredenciales() {
  const rutas = [
    path.join(os.homedir(), '.claude', '.credentials.json'),
    path.join(os.homedir(), '.config', 'claude', '.credentials.json'),
  ];
  for (const rutaArchivo of rutas) {
    try {
      const contenido = fs.readFileSync(rutaArchivo, 'utf8');
      const json = JSON.parse(contenido);
      const oauth = json && json.claudeAiOauth;
      if (oauth && oauth.accessToken) {
        return { accessToken: oauth.accessToken, refreshToken: oauth.refreshToken || null,
          expiresAt: oauth.expiresAt || null, rutaArchivo, jsonCompleto: json };
      }
    } catch {}
  }
  return null;
}

// SEGURIDAD: refreshToken solo sale a claude.ai; el accessToken resultante
// solo va a api.anthropic.com, nunca al frontend ni a logs.
function refreshearToken(creds) {
  return new Promise((resolve, reject) => {
    if (!creds.refreshToken) {
      reject(new Error('No hay refresh token. Corre claude en la terminal para renovar la sesion.'));
      return;
    }
    const cuerpo = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
    }).toString();
    const opciones = { hostname: 'claude.ai', path: '/api/auth/oauth/token', method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(cuerpo) } };
    const req = https.request(opciones, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error('Renovacion fallo (estado ' + res.statusCode + '). Corre claude en terminal.'));
          return;
        }
        let data;
        try { data = JSON.parse(body); } catch { reject(new Error('Respuesta de renovacion invalida.')); return; }
        const nuevoToken = data.access_token;
        if (!nuevoToken) { reject(new Error('La renovacion no devolvio token.')); return; }
        try {
          const json = creds.jsonCompleto;
          json.claudeAiOauth.accessToken = nuevoToken;
          const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
          json.claudeAiOauth.expiresAt = Date.now() + expiresIn * 1000;
          if (data.refresh_token) json.claudeAiOauth.refreshToken = data.refresh_token;
          fs.writeFileSync(creds.rutaArchivo, JSON.stringify(json, null, 2), 'utf8');
        } catch (e) { console.warn('[Radar] No se pudo persistir token:', e.message); }
        resolve(nuevoToken);
      });
    });
    req.on('error', reject); req.write(cuerpo); req.end();
  });
}

// El token NUNCA se devuelve al frontend ni se escribe en logs.
// Lanza ErrorAutenticacion si recibe 401.
function consultarUso(token) {
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
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => reject(new Error('Error 400 de la API: ' + body)));
        return;
      }
      const h = res.headers;
      const sessionUtil   = parseFloat(h['anthropic-ratelimit-unified-5h-utilization']  || '0');
      const sessionReset  = parseInt(h['anthropic-ratelimit-unified-5h-reset']           || '0', 10);
      const sessionStatus = h['anthropic-ratelimit-unified-5h-status']                   || 'active';
      const weekUtil   = parseFloat(h['anthropic-ratelimit-unified-7d-utilization']  || '0');
      const weekReset  = parseInt(h['anthropic-ratelimit-unified-7d-reset']           || '0', 10);
      const weekStatus = h['anthropic-ratelimit-unified-7d-status']                   || 'active';
      const representativeClaim = h['anthropic-ratelimit-unified-representative-claim'] || null;
      const overage             = h['anthropic-ratelimit-unified-overage-status']        || null;
      res.resume();
      resolve({
        session: { utilization: sessionUtil, reset: sessionReset, status: sessionStatus },
        week:    { utilization: weekUtil,    reset: weekReset,    status: weekStatus    },
        representativeClaim,
        overage: overage === 'null' ? null : overage,
      });
    });
    req.on('error', reject); req.write(cuerpo); req.end();
  });
}

app.get('/usage', async (req, res) => {
  const forzar = req.query.force === 'true';
  const ahora  = Date.now();
  if (!forzar && cache.data && ahora - cache.timestamp < CACHE_TTL_MS)
    return res.json(Object.assign({}, cache.data, { cached: true }));
  const creds = leerCredenciales();
  if (!creds) return res.json({
    session: null, week: null, representativeClaim: null, overage: null,
    updatedAt: new Date().toISOString(), cached: false,
    error: 'No se encontro token. Corre claude en la terminal.',
  });
  let tokenActual = creds.accessToken;
  if (creds.refreshToken && creds.expiresAt && ahora > creds.expiresAt - 30000) {
    try { tokenActual = await refreshearToken(creds); }
    catch (e) { console.warn('[Radar] Pre-refresh fallo:', e.message); }
  }
  const enviar = (datos) => {
    const r = Object.assign({}, datos, { updatedAt: new Date().toISOString(), cached: false, error: null });
    cache.data = r; cache.timestamp = ahora; return res.json(r);
  };
  const errorJson = (msg) => res.json({
    session: null, week: null, representativeClaim: null, overage: null,
    updatedAt: new Date().toISOString(), cached: false, error: msg,
  });
  try {
    return enviar(await consultarUso(tokenActual));
  } catch (err) {
    if (err instanceof ErrorAutenticacion && creds.refreshToken) {
      try { return enviar(await consultarUso(await refreshearToken(creds))); }
      catch (e2) { return errorJson(e2.message); }
    }
    return errorJson(err instanceof ErrorAutenticacion
      ? 'Sesion expirada. Corre claude en la terminal.'
      : err.message);
  }
});

app.listen(PORT, () => console.log('Servidor de uso en http://localhost:' + PORT + ' — deja esta ventana abierta.'));
