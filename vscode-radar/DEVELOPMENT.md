# Desarrollo — Radar de Tokens

## Prerrequisitos

- [Node.js](https://nodejs.org/) >= 18
- [Visual Studio Code](https://code.visualstudio.com/)

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

1. Abrí la carpeta `vscode-radar/` en VS Code
2. Presioná **F5** (Run → Start Debugging)
3. Se abre una nueva ventana (Extension Development Host)
4. Abrí la **Command Palette** (Ctrl+Shift+P) y ejecutá:
   - `Radar: Mostrar panel` — abre el panel de uso
   - `Radar: Actualizar uso` — fuerza refresh
5. Para recargar cambios: guardá los archivos y presioná **F5** de nuevo (o el botón ↻ en la barra de debug)

## Empaquetar para Marketplace

```bash
npm install -g @vscode/vsce
vsce package
```

Esto genera `radar-tokens-vegeta-1.0.0.vsix`.

### Instalar el .vsix localmente

Extensiones (Ctrl+Shift+X) → ⋮ (esquina superior derecha) → **Install from VSIX...** → seleccionar el archivo.

### Publicar en Marketplace

```bash
vsce publish
```

Requiere autenticación con el publisher (`radar-tokens`). Configurarla con:

```bash
vsce login radar-tokens
```

Más info: https://code.visualstudio.com/api/working-with-extensions/publishing-extension

## Notas

- Los archivos fuente TypeScript están en `src/`, los webview assets en `src/webview/` y las imágenes en `assets/`.
- `.vscodeignore` excluye `src/`, `node_modules/` y `tsconfig.json` del empaquetado final.
- `vscode:prepublish` (corre al hacer `vsce package`) ejecuta `compile`, `cp:webview` y `cp:assets` automáticamente.
