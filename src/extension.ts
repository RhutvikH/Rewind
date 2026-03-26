import * as vscode from 'vscode';
import { Recorder, scanFiles, buildGraph, getWebviewContent } from './recorder';

export function activate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage('Rewind extension activated!');

  const recorder = new Recorder(context);

  // Highlight for already open editor on activation
  if (vscode.window.activeTextEditor) {
    recorder.highlightRecordedLines();
  }

  vscode.window.onDidChangeActiveTextEditor(() => {
    recorder.highlightRecordedLines();
  });

  vscode.workspace.onDidOpenTextDocument(() => {
    recorder.highlightRecordedLines();
  });

  // ---------------- PLAY FOR LINE ----------------
  context.subscriptions.push(
    vscode.commands.registerCommand('rewind.playForLine', () => {
      recorder.playForLine();
    })
  );

  // ---------------- START RECORDING ----------------
  context.subscriptions.push(
    vscode.commands.registerCommand('rewind.startRecording', () => {
      recorder.startRecording();
    })
  );

  // ---------------- STOP RECORDING ----------------
  context.subscriptions.push(
    vscode.commands.registerCommand('rewind.stopRecording', () => {
      recorder.stopRecording();
    })
  );

  // ---------------- SHOW GRAPH ----------------
  context.subscriptions.push(
    vscode.commands.registerCommand('rewind.showGraph', () => {
      const panel = vscode.window.createWebviewPanel(
        'rewindGraph',
        'Rewind – Code Graph',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      panel.webview.html = getWebviewContent();

      const workspace = vscode.workspace.workspaceFolders?.[0];
      if (!workspace) {
        vscode.window.showErrorMessage(
          'Open a folder in the Extension Development Host first'
        );
        return;
      }

      const files = scanFiles(workspace.uri.fsPath);
      const graphData = buildGraph(files, workspace.uri.fsPath);

      panel.webview.onDidReceiveMessage(message => {
        if (message.type === 'ready') {
          panel.webview.postMessage(graphData);
        }
      });
    })
  );

  // ---------------- TRACK CHANGES ----------------
  vscode.workspace.onDidChangeTextDocument(event => {
    recorder.trackChange(event);
  });
}

export function deactivate() {}
