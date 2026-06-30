# Diseño: Instalador gráfico (reemplazo de instalar.bat / instalar.ps1)

**Fecha:** 2026-06-30
**Proyecto:** Radar de Tokens — Vegeta
**Alcance:** Reemplazar el instalador de consola (`instalar.bat` + `instalar.ps1`) por un instalador gráfico nativo de Windows, sin ventanas de consola visibles en ningún momento.

---

## Resumen

Hoy `instalar.bat` lanza `instalar.ps1` en una consola PowerShell visible (texto de progreso con `Write-Host`), y además abre una segunda ventana de `cmd` para el login interactivo de Claude. Esto se reemplaza por un instalador gráfico construido con **Inno Setup**: un único artefacto `RadarDeTokens-Setup.exe` con wizard de pantallas (Bienvenida → Licencia → Carpeta de destino → Progreso → Fin), tematizado con la identidad visual de Vegeta, sin ninguna consola visible.

---

## Decisiones de diseño

| Decisión | Elección | Motivo |
|---|---|---|
| Herramienta | Inno Setup | Da el aspecto de "instalador común de Windows" (wizard nativo) sin depender de runtimes adicionales para el usuario final; solo se necesita en el equipo de desarrollo para compilar |
| Lógica de instalación | Reescrita en Pascal Script (`installer/setup.iss`) | Se elimina `instalar.ps1`; toda la orquestación (Node, login, tarea programada) vive en el script de Inno Setup, integrada con las páginas del wizard |
| Estilo visual | Tematizado con Vegeta (banner oscuro/dorado con foto de Vegeta como imagen lateral del wizard) | Validado en brainstorming visual — opción A frente al wizard genérico azul/blanco de Inno Setup por defecto |
| Empaquetado | El `.exe` contiene `server/` y `extension/` adentro, y los copia a `%LocalAppData%\RadarDeTokens\` al instalar | Comportamiento esperado de un instalador real: un solo archivo para distribuir, nada que clonar a mano |
| Node.js portable | Se sigue descargando en el momento de instalar, solo si no hay Node en el sistema (no se embebe en el `.exe`) | Mantiene el instalador liviano (pocos MB); coherente con el comportamiento actual de `instalar.ps1` |
| Privilegios | Sin privilegios de administrador (`PrivilegesRequired=lowest`) | Igual que hoy: instalación 100% en el perfil del usuario, sin tocar Program Files |
| Login de Claude | Página de progreso con mensaje + sondeo en segundo plano del archivo de credenciales (sin ventana de `cmd`) | Elimina la única ventana de consola que quedaba en el flujo actual |
| Licencia | Archivo `LICENSE` (MIT) en la raíz del repo | El proyecto va a tener colaboradores; MIT es la licencia open-source más simple y permisiva. Además activa automáticamente la pantalla de licencia del wizard |
| Desinstalación | Completa: detiene el servidor, borra la tarea programada `RadarDeTokens` y elimina la carpeta instalada | Comportamiento esperado de "Agregar o quitar programas"; no toca las credenciales de Claude ni desinstala Claude Code |

---

## Pantallas del wizard

1. **Bienvenida** — banner lateral oscuro con foto de Vegeta y acentos dorados (`#ffd700`), texto: "Bienvenido al instalador de Radar de Tokens".
2. **Licencia** — texto de `LICENSE` (MIT) con checkbox "Acepto el acuerdo"; bloquea "Siguiente" hasta aceptar.
3. **Carpeta de destino** — pantalla estándar de Inno Setup, pre-rellenada con `%LocalAppData%\RadarDeTokens`, editable.
4. **Progreso de instalación** — única pantalla "inteligente", ejecuta en orden:
   1. Copia `server/` y `extension/` a la carpeta elegida.
   2. Busca Node.js: si no está en el `PATH`, descarga el portable oficial a `<carpeta instalada>\server\node.exe`, mostrando % real de descarga en la barra de progreso de Inno Setup.
   3. Verifica `~/.claude/.credentials.json` (o `~/.config/claude/...`). Si faltan credenciales:
      - Lanza `claude` oculto (sin ventana de consola) para que abra el navegador de login.
      - La página muestra: *"Se abrió tu navegador para iniciar sesión en Claude. Completá el login y esta pantalla avanza sola."* con un indicador de espera (spinner/marquee).
      - Sondea en segundo plano (timer de Pascal Script) la aparición del archivo de credenciales; al detectarlo, avanza automáticamente.
   4. Registra la tarea programada `RadarDeTokens` (arranque oculto al iniciar sesión) apuntando a la carpeta instalada, igual que hoy vía `start-hidden.vbs`.
   5. Arranca el servidor y verifica que `http://localhost:37123/usage` responde.
5. **Fin** — si el servidor respondió, muestra el % de uso actual (sesión/semana). Incluye instrucciones para cargar la extensión en Chrome con la ruta exacta (`%LocalAppData%\RadarDeTokens\extension`) y un botón **"Abrir carpeta"** que la abre en el Explorador de Windows.

---

## Desinstalación

El desinstalador autogenerado por Inno Setup (entrada en "Agregar o quitar programas") hace, en orden:
1. Detiene la tarea programada `RadarDeTokens` y mata el proceso de `node.exe` si el servidor sigue corriendo.
2. Elimina la tarea programada del Programador de tareas de Windows.
3. Borra `%LocalAppData%\RadarDeTokens\` completa (server, extension, node.exe portable si se llegó a descargar).

No toca `~/.claude/.credentials.json` ni desinstala Claude Code.

---

## Cambios por archivo

### Nuevos
- `LICENSE` — texto MIT estándar, `Copyright (c) 2026 thiagossj7`.
- `installer/setup.iss` — script fuente de Inno Setup: secciones `[Setup]`, `[Files]`, `[Tasks]`, `[Code]` (Pascal Script) con la lógica de Node/login/tarea programada/desinstalación descrita arriba.
- `RadarDeTokens-Setup.exe` — artefacto compilado, commiteado en la raíz del repo para mantener la experiencia de "un solo archivo, doble clic".

### Eliminados
- `instalar.bat`
- `instalar.ps1`

### Modificados
- `CLAUDE.md` (raíz) y `radar-vegeta-tokens/CLAUDE.md` — sección "Cómo correr el proyecto" / "Instalación de usuario final": reemplazar las referencias a `instalar.bat` por `RadarDeTokens-Setup.exe`, y documentar la estructura `installer/setup.iss` además del comando de compilación (`ISCC installer/setup.iss`).
- `README.md` — actualizar la mención de `instalar.bat` al nuevo flujo. **No tocar** la mención de "Node.js + Express" (relicto intencional ya documentado en `CLAUDE.md`).

### Fuera de scope
- `server/server.js` — sin cambios de lógica; solo cambia dónde vive en disco tras la instalación.
- `extension/` — sin cambios; solo cambia la ruta que se le indica al usuario para "Cargar descomprimida".

---

## Criterios de éxito

- [ ] Ejecutar `RadarDeTokens-Setup.exe` no abre ninguna ventana de consola (`cmd` o PowerShell) en ningún momento del flujo.
- [ ] El wizard muestra las 5 pantallas en orden: Bienvenida → Licencia → Carpeta de destino → Progreso → Fin.
- [ ] La pantalla de Bienvenida usa el banner oscuro/dorado con la foto de Vegeta.
- [ ] Si el sistema no tiene Node, se descarga el portable mostrando progreso real, sin bloquear el wizard.
- [ ] Si no hay credenciales de Claude, la pantalla de progreso espera el login sin abrir ninguna ventana de consola y avanza sola al detectarlas.
- [ ] Al finalizar, la tarea programada `RadarDeTokens` existe y el servidor responde en `http://localhost:37123/usage`.
- [ ] La pantalla de Fin muestra el % de uso actual y permite abrir la carpeta de la extensión con un clic.
- [ ] Desinstalar desde "Agregar o quitar programas" detiene el servidor, borra la tarea programada y elimina la carpeta instalada.
- [ ] `instalar.bat` e `instalar.ps1` ya no existen en el repo.
- [ ] `LICENSE` (MIT) existe en la raíz y coincide con el texto mostrado en la pantalla de licencia del wizard.
