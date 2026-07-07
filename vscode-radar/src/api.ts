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
