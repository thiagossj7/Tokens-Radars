# Status bar + DEVELOPMENT.md

## 1. Status bar — `src/extension.ts:30-36`

Reemplazar:

```typescript
  const s = datos.session?.utilization ?? 0;
  const w = datos.week?.utilization ?? 0;
  const claim = datos.representativeClaim;
  const primero = claim === 'seven_day' ? w : s;
  const segundo = claim === 'seven_day' ? s : w;
  const warning = (s >= 1 || w >= 1) ? ' ⚠' : '';
  statusBarItem.text = `$(graph) ${(primero * 100).toFixed(0)}% · ${(segundo * 100).toFixed(0)}%${warning}`;
```

Por:

```typescript
  const s = datos.session?.utilization ?? 0;
  const w = datos.week?.utilization ?? 0;
  const warning = (s >= 1 || w >= 1) ? ' ⚠' : '';
  statusBarItem.text = `$(graph) Claude S:${(s * 100).toFixed(0)}% W:${(w * 100).toFixed(0)}%${warning}`;
```

## 2. Crear `DEVELOPMENT.md`

```markdown
# Desarrollo — Radar de Tokens

## Prerrequisitos

- Node.js >= 18
- Visual Studio Code

## Setup

```bash
cd vscode-radar
npm install
```

## Compilar y copiar archivos

```bash
npm run compile       # tsc: .ts → .js en out/
npm run cp:webview    # copia panel.html/css/js a out/webview/
npm run cp:assets     # copia imágenes a out/webview/
```

O todo junto:

```bash
npm run compile && npm run cp:webview && npm run cp:assets
```

## Probar en desarrollo

1. Abrir `vscode-radar/` en VS Code
2. Presionar F5 (Run → Start Debugging)
3. Se abre una nueva ventana (Extension Development Host)
4. Command Palette (Ctrl+Shift+P) → `Radar: Mostrar panel`
5. Para recargar: guardar cambios → F5 de nuevo

## Empaquetar para Marketplace

```bash
npm install -g @vscode/vsce
vsce package
```

Genera `radar-tokens-vegeta-1.0.0.vsix`.

### Instalar .vsix localmente

Extensiones → ⋮ → Install from VSIX...

### Publicar

```bash
vsce login radar-tokens
vsce publish
```

## Notas

- TypeScript en `src/`, webview en `src/webview/`, imágenes en `assets/`
- `.vscodeignore` excluye `src/`, `node_modules/`, `tsconfig.json`
- `vscode:prepublish` corre automáticamente al empaquetar
```

## 3. Rebuild

```bash
cd vscode-radar
npm run compile && npm run cp:webview && npm run cp:assets
```
