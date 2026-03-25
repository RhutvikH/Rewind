// VS Code API
import * as vscode from 'vscode';

// Node APIs
import * as fs from 'fs';
import * as path from 'path';

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

/* ----------------------------------------------------
   FILE SCANNING
---------------------------------------------------- */
let isRecording = false;
let recordingStartTime = 0;
let sessionEvents: any[] = [];
let sessionId: string = '';

let soxProcess: ChildProcessWithoutNullStreams | null = null;
let recordingDecoration: vscode.TextEditorDecorationType;


function scanFiles(dir: string, files: string[] = []): string[] {
  for (const file of fs.readdirSync(dir)) {
    if (file === 'node_modules' || file === '.git') continue;

    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanFiles(fullPath, files);
    } else if (
      file.endsWith('.ts') ||
      file.endsWith('.js') ||
      file.endsWith('.tsx') ||
      file.endsWith('.jsx')
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

/* ----------------------------------------------------
   DEPENDENCY EXTRACTION
---------------------------------------------------- */

function extractDependencies(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');

  const regex = /from\s+['"](.*?)['"]|require\(['"](.*?)['"]\)/g;
  const deps: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    deps.push(match[1] || match[2]);
  }

  return deps;
}

/* ----------------------------------------------------
   GRAPH BUILDING
---------------------------------------------------- */

function buildGraph(files: string[], root: string) {
  const nodes: { id: string; label: string }[] = [];
  const edges: { from: string; to: string }[] = [];

  const fileMap = new Map<string, string>();

  /* ---------- Nodes ---------- */
  files.forEach(file => {
    const relative = path
      .relative(root, file)
      .replace(/\\/g, '/');

    fileMap.set(file, relative);

    nodes.push({
      id: relative,
      label: path.basename(file)
    });
  });

  /* ---------- Edges ---------- */
  files.forEach(file => {
    const from = fileMap.get(file);
    if (!from) return;

    const deps = extractDependencies(file);

    deps.forEach(dep => {
      if (!dep.startsWith('.')) return;

      const resolvedBase = path
        .resolve(path.dirname(file), dep)
        .replace(/\\/g, '/');

      const candidates = [
        resolvedBase,
        resolvedBase + '.ts',
        resolvedBase + '.js',
        resolvedBase + '.tsx',
        resolvedBase + '.jsx',
        `${resolvedBase}/index.ts`,
        `${resolvedBase}/index.js`,
        `${resolvedBase}/index.tsx`,
        `${resolvedBase}/index.jsx`
      ];

      const target = candidates
        .map(c => fileMap.get(c))
        .find(Boolean);

      if (target) {
        edges.push({ from, to: target });
      }
    });
  });

  return { nodes, edges };
}

/* ----------------------------------------------------
   HIGHLIGHT RECORDED LINES
---------------------------------------------------- */

function highlightRecordedLines(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) return;

  const rewindFolder = path.join(workspace.uri.fsPath, '.rewind');
  if (!fs.existsSync(rewindFolder)) return;

  const jsonFiles = fs.readdirSync(rewindFolder)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();

  if (jsonFiles.length === 0) return;

  const latestSession = JSON.parse(
    fs.readFileSync(path.join(rewindFolder, jsonFiles[0]), 'utf-8')
  );

  const file = vscode.workspace.asRelativePath(editor.document.uri);
  const decorations: vscode.DecorationOptions[] = [];

  latestSession.events.forEach((e: any) => {
    if (e.file !== file) return;
    if (e.line === undefined || e.line === null) return;
    if (typeof e.line !== 'number') return;
    if (e.line < 0 || e.line >= editor.document.lineCount) return;

    const range = new vscode.Range(
      e.line, 0,
      e.line, editor.document.lineAt(e.line).text.length
    );

    const md = new vscode.MarkdownString(
      `🎙 **Click to hear explanation**\n\n[Play Recording](command:rewind.playForLine)`
    );
    md.isTrusted = true;

    decorations.push({ range, hoverMessage: md });
  });

  editor.setDecorations(recordingDecoration, decorations);
}

/* ----------------------------------------------------
   AUDIO PLAYER
---------------------------------------------------- */

function openAudioPlayer(
  context: vscode.ExtensionContext,
  audioFile: string,
  timestamp: number
) {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) return;

  const audioPath = vscode.Uri.file(
    path.join(workspace.uri.fsPath, '.rewind', audioFile)
  );

  const panel = vscode.window.createWebviewPanel(
    'rewindPlayer',
    'Rewind Playback',
    vscode.ViewColumn.Two,
    { enableScripts: true }
  );

  const audioUri = panel.webview.asWebviewUri(audioPath);

  panel.webview.html = `
  <html>
    <body style="background:#0f111a;color:white;font-family:sans-serif;">
      <h2>Rewind Playback</h2>
      <audio id="player" controls autoplay>
        <source src="${audioUri}" type="audio/wav">
      </audio>
      <script>
        const player = document.getElementById('player');
        player.currentTime = ${timestamp / 1000};
      </script>
    </body>
  </html>
  `;
}

/* ----------------------------------------------------
   EXTENSION ENTRY
---------------------------------------------------- */

export function activate(context: vscode.ExtensionContext) {

  vscode.window.showInformationMessage('Rewind extension activated!');

  recordingDecoration = vscode.window.createTextEditorDecorationType({
    gutterIconPath: context.asAbsolutePath('media/mic.svg'),
    gutterIconSize: 'contain',
    backgroundColor: 'rgba(255, 200, 0, 0.08)',
    overviewRulerColor: 'rgba(255, 200, 0, 0.8)',
    overviewRulerLane: vscode.OverviewRulerLane.Left,
  });

  // Highlight for already open editor on activation
  if (vscode.window.activeTextEditor) {
    highlightRecordedLines(context);
  }

  vscode.window.onDidChangeActiveTextEditor(() => {
    highlightRecordedLines(context);
  });

  vscode.workspace.onDidOpenTextDocument(() => {
    highlightRecordedLines(context);
  });

  // ---------------- PLAY FOR LINE ----------------
  const playForLine = vscode.commands.registerCommand(
    'rewind.playForLine',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const workspace = vscode.workspace.workspaceFolders?.[0];
      if (!workspace) return;

      const file = vscode.workspace.asRelativePath(editor.document.uri);
      const line = editor.selection.active.line;

      const rewindFolder = path.join(workspace.uri.fsPath, '.rewind');

      const jsonFiles = fs.readdirSync(rewindFolder)
        .filter(f => f.endsWith('.json'))
        .sort()
        .reverse();

      if (jsonFiles.length === 0) {
        vscode.window.showInformationMessage('No recordings found');
        return;
      }

      const latestSession = JSON.parse(
        fs.readFileSync(path.join(rewindFolder, jsonFiles[0]), 'utf-8')
      );

      const match = latestSession.events.find(
        (e: any) => e.file === file && e.line === line
      );

      if (!match) {
        vscode.window.showInformationMessage('No explanation for this line');
        return;
      }

      openAudioPlayer(context, latestSession.audioFile, match.timestamp);
    }
  );

  context.subscriptions.push(playForLine);

  // ---------------- START RECORDING ----------------
  const startRecording = vscode.commands.registerCommand(
    'rewind.startRecording',
    () => {
      const workspace = vscode.workspace.workspaceFolders?.[0];
      if (!workspace) {
        vscode.window.showErrorMessage('Open a folder first');
        return;
      }

      const rewindFolder = path.join(workspace.uri.fsPath, '.rewind');
      if (!fs.existsSync(rewindFolder)) {
        fs.mkdirSync(rewindFolder);
      }

      sessionId = Date.now().toString();
      const audioPath = path.join(rewindFolder, `${sessionId}.wav`);

      isRecording = true;
      recordingStartTime = Date.now();
      sessionEvents = [];

      const isWindows = process.platform === 'win32';

      try {
        soxProcess = spawn('sox', [
          ...(isWindows ? ['-t', 'waveaudio', '0'] : ['-d']),
          '-c', '1',
          '-r', '16000',
          audioPath
        ]);

        soxProcess.stderr.on('data', (data) => {
          console.log(`SoX stderr: ${data}`);
        });

        soxProcess.on('error', (err) => {
          vscode.window.showErrorMessage(
            'Failed to start SoX. Is SoX installed and added to PATH?'
          );
          console.error(err);
        });

        vscode.window.showInformationMessage('🎙 Thought recording started');

      } catch (err) {
        vscode.window.showErrorMessage('Could not start recording.');
        console.error(err);
      }
    }
  );

  context.subscriptions.push(startRecording);

  // ---------------- STOP RECORDING ----------------
  const stopRecording = vscode.commands.registerCommand(
    'rewind.stopRecording',
    () => {
      if (!isRecording || !soxProcess) {
        vscode.window.showErrorMessage('No active recording');
        return;
      }

      isRecording = false;

      soxProcess.kill('SIGINT');
      soxProcess = null;

      const workspace = vscode.workspace.workspaceFolders?.[0];
      if (!workspace) return;

      const rewindFolder = path.join(workspace.uri.fsPath, '.rewind');
      const metadata = {
        sessionId,
        audioFile: `${sessionId}.wav`,
        events: sessionEvents
      };

      setTimeout(() => {
        fs.writeFileSync(
          path.join(rewindFolder, `${sessionId}.json`),
          JSON.stringify(metadata, null, 2)
        );

        const audioPath = path.join(rewindFolder, `${sessionId}.wav`);
        const wavExists = fs.existsSync(audioPath);

        vscode.window.showInformationMessage(
          wavExists
            ? '🧠 Thought recording saved successfully'
            : '⚠️ JSON saved but WAV file missing — is SoX installed?'
        );

        highlightRecordedLines(context);
      }, 500);
    }
  );

  context.subscriptions.push(stopRecording);

  // ---------------- SHOW GRAPH ----------------
  const disposable = vscode.commands.registerCommand(
    'rewind.showGraph',
    () => {
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
    }
  );

  context.subscriptions.push(disposable);

  // ---------------- TRACK CHANGES ----------------
  vscode.workspace.onDidChangeTextDocument(event => {
    if (!isRecording) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    if (!event.contentChanges || event.contentChanges.length === 0) return;

    const file = vscode.workspace.asRelativePath(event.document.uri);
    const line = event.contentChanges[0]?.range.start.line;

    if (line === undefined) return;

    sessionEvents.push({
      file,
      line,
      timestamp: Date.now() - recordingStartTime
    });
  });
}

export function deactivate() {}

/* ----------------------------------------------------
   WEBVIEW UI
---------------------------------------------------- */

function getWebviewContent(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body {
      margin: 0;
      background-color: #0f111a;
      color: #e6edf3;
      font-family: system-ui, sans-serif;
    }
    h2 {
      padding: 8px;
      margin: 0;
      font-size: 16px;
    }
    #graph {
      width: 100%;
      height: calc(100vh - 40px);
    }
  </style>
</head>
<body>
  <h2>Rewind Code Graph</h2>
  <div id="graph"></div>

  <script src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>

  <script>
    const vscode = acquireVsCodeApi();
    const container = document.getElementById('graph');

    vscode.postMessage({ type: 'ready' });

    window.addEventListener('message', event => {
      const graph = event.data;

      const nodes = new vis.DataSet(graph.nodes);
      const edges = new vis.DataSet(graph.edges);

      const options = {
        nodes: {
          shape: 'dot',
          size: 14,
          color: {
            background: '#1f6feb',
            border: '#58a6ff'
          },
          font: {
            color: '#e6edf3',
            size: 12
          }
        },
        edges: {
          color: '#8b949e',
          arrows: 'to'
        },
        physics: {
          enabled: true,
          stabilization: false
        }
      };

      new vis.Network(container, { nodes, edges }, options);
    });
  </script>
</body>
</html>
`;
}