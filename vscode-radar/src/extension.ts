import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('radar.refresh', () => {}),
    vscode.commands.registerCommand('radar.showPanel', () => {}),
    vscode.commands.registerCommand('radar.closePanel', () => {})
  );
}

export function deactivate() {}
