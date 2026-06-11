# Servidor — Radar de Tokens

Servidor local Node.js que expone el uso del plan de Claude en `http://localhost:37123/usage`.

## Arrancar

```bash
npm install   # solo la primera vez
npm start
```

## Endpoint `GET /usage`

Devuelve el uso actual del plan. Si el último dato tiene menos de 60 segundos, responde desde caché sin llamar a la API.

```
GET http://localhost:37123/usage
GET http://localhost:37123/usage?force=true   ← ignora la caché, siempre fresco
```

### Respuesta exitosa

```json
{
  "session": {
    "utilization": 0.32,
    "reset": 1749520200,
    "status": "active"
  },
  "week": {
    "utilization": 0.15,
    "reset": 1749880800,
    "status": "active"
  },
  "representativeClaim": "five_hour",
  "overage": null,
  "updatedAt": "2026-06-10T03:00:00.000Z",
  "cached": false,
  "error": null
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `session.utilization` | `number` | Uso de la ventana de 5 h (0.0 = 0%, 1.0 = 100%, >1.0 = excedido) |
| `session.reset` | `number` | Epoch en segundos en que se reinicia la ventana de sesión |
| `session.status` | `string` | `active`, `warning` o `rate_limited` |
| `week.utilization` | `number` | Igual que `session` pero para la ventana de 7 días |
| `week.reset` | `number` | Epoch de reinicio semanal |
| `week.status` | `string` | `active`, `warning` o `rate_limited` |
| `representativeClaim` | `string\|null` | Ventana que actualmente te limita: `five_hour` o `seven_day` |
| `overage` | `string\|null` | Estado de exceso de plan, o `null` si está dentro del límite |
| `updatedAt` | `string` | ISO 8601 — cuándo se obtuvo el dato |
| `cached` | `boolean` | `true` si la respuesta viene de caché; `false` si se hizo una lectura nueva |
| `error` | `string\|null` | Mensaje de error, o `null` si todo fue bien |

### Respuesta con error

```json
{
  "session": null,
  "week": null,
  "representativeClaim": null,
  "overage": null,
  "updatedAt": "2026-06-10T03:00:00.000Z",
  "cached": false,
  "error": "No se encontró un token de Claude Code válido. Inicia sesión corriendo `claude` en la terminal."
}
```

## Cómo obtiene el dato

1. Lee el token OAuth desde `~/.claude/.credentials.json` (campo `claudeAiOauth.accessToken`). Si no lo encuentra, prueba `~/.config/claude/.credentials.json`.
2. Hace un `POST` mínimo a `https://api.anthropic.com/v1/messages` con el modelo `claude-haiku-4-5-20251001` y `max_tokens: 1`.
3. Extrae las cabeceras `anthropic-ratelimit-unified-*` de la respuesta HTTP.
4. Guarda el resultado en caché por 60 segundos.

El token **nunca** se devuelve al cliente ni aparece en los logs.

## Notas de seguridad

- El token solo se envía hacia `api.anthropic.com`. Nunca a ningún otro destino.
- La extensión Chrome recibe únicamente los porcentajes de uso, no el token.
- `node_modules/` y cualquier archivo de credenciales están excluidos del `.gitignore`.
