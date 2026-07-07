import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { obtenerUso } from './api';
import { DatosUso } from './tipos';

let statusBarItem: vscode.StatusBarItem;
let pollTimer: NodeJS.Timeout | undefined;
let webviewPanel: vscode.WebviewPanel | undefined;
let datosActuales: DatosUso | null = null;

function textoReset(epochSeg: number): string {
  if (!epochSeg) return '';
  const diffMs = epochSeg * 1000 - Date.now();
  if (diffMs <= 0) return 'se reinicia pronto';
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `se reinicia en ${h} h ${m} min` : `se reinicia en ${m} min`;
}

function actualizarStatusBar(datos: DatosUso) {
  if (datos.error) {
    statusBarItem.text = '$(alert) Claude: no auth';
    statusBarItem.tooltip = datos.error + '\nCorre \'claude\' en la terminal para iniciar sesión';
    statusBarItem.color = undefined;
    return;
  }
  const s = datos.session?.utilization ?? 0;
  const w = datos.week?.utilization ?? 0;
  const claim = datos.representativeClaim;
  const primero = claim === 'seven_day' ? w : s;
  const segundo = claim === 'seven_day' ? s : w;
  const warning = (s >= 1 || w >= 1) ? ' ⚠' : '';
  statusBarItem.text = `$(graph) ${(primero * 100).toFixed(0)}% · ${(segundo * 100).toFixed(0)}%${warning}`;
  if (s >= 1 || w >= 1) {
    statusBarItem.color = '#ef4444';
  } else if (s >= 0.8 || w >= 0.8) {
    statusBarItem.color = '#eab308';
  } else {
    statusBarItem.color = '#22c55e';
  }
  statusBarItem.tooltip = [
    `Sesión 5h: ${(s * 100).toFixed(1)}% — ${textoReset(datos.session?.reset ?? 0)}`,
    `Semana 7d: ${(w * 100).toFixed(1)}% — ${textoReset(datos.week?.reset ?? 0)}`,
  ].join('\n');
}

function debeDispararRuptura(datos: DatosUso): boolean {
  return (datos.session?.utilization ?? 0) >= 1 || (datos.week?.utilization ?? 0) >= 1;
}

async function refrescarUso(forzar = false) {
  const datos = await obtenerUso(forzar);
  datosActuales = datos;
  actualizarStatusBar(datos);
  if (debeDispararRuptura(datos)) {
    abrirPanel(true);
  } else if (webviewPanel) {
    enviarDatosAlPanel(datos);
  }
}

function enviarDatosAlPanel(datos: DatosUso) {
  if (webviewPanel) {
    webviewPanel.webview.postMessage({ type: 'usageData', data: datos });
  }
}

function abrirPanel(ruptura = false) {
  if (webviewPanel) {
    webviewPanel.reveal(vscode.ViewColumn.Beside);
    if (datosActuales) enviarDatosAlPanel(datosActuales);
    if (ruptura && datosActuales) {
      webviewPanel.webview.postMessage({ type: 'rupture', data: datosActuales });
    }
    return;
  }
  const extensionPath = vscode.extensions.getExtension('radar-tokens-vegeta')
    ?.extensionPath || path.join(__dirname, '..');
  const webviewPath = path.join(extensionPath, 'out', 'webview');
  webviewPanel = vscode.window.createWebviewPanel(
    'radarTokens',
    'Radar de Tokens — Vegeta',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.file(webviewPath)],
    }
  );
  const htmlFilePath = path.join(webviewPath, 'panel.html');
  let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
  const webviewUri = webviewPanel.webview.asWebviewUri(vscode.Uri.file(webviewPath));
  htmlContent = htmlContent.replace(/\$\{webviewUri\}/g, webviewUri.toString());
  webviewPanel.webview.html = htmlContent;
  webviewPanel.onDidDispose(() => { webviewPanel = undefined; });
  webviewPanel.webview.onDidReceiveMessage((msg) => {
    if (msg.type === 'requestUsage' && datosActuales) {
      enviarDatosAlPanel(datosActuales);
    }
  });
  if (datosActuales) enviarDatosAlPanel(datosActuales);
  if (ruptura && datosActuales) {
    setTimeout(() => webviewPanel?.webview.postMessage({ type: 'rupture', data: datosActuales }), 500);
  }
}

function cerrarPanel() {
  if (webviewPanel) { webviewPanel.dispose(); webviewPanel = undefined; }
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(sync~spin) Radar...';
  statusBarItem.tooltip = 'Consultando uso de Claude...';
  statusBarItem.command = 'radar.showPanel';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(
    vscode.commands.registerCommand('radar.refresh', () => refrescarUso(true)),
    vscode.commands.registerCommand('radar.showPanel', () => abrirPanel(false)),
    vscode.commands.registerCommand('radar.closePanel', cerrarPanel),
  );
  refrescarUso(false);
  pollTimer = setInterval(() => refrescarUso(false), 60000);
  context.subscriptions.push({ dispose: () => { if (pollTimer) clearInterval(pollTimer); } });
}

export function deactivate() {
  if (pollTimer) clearInterval(pollTimer);
}
