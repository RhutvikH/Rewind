// VS Code API
import * as vscode from 'vscode';

// Node APIs
import * as fs from 'fs';
import * as path from 'path';

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

/* ----------------------------------------------------
   FILE SCANNING
---------------------------------------------------- */

export function scanFiles(dir: string, files: string[] = []): string[] {
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

export function extractDependencies(filePath: string): string[] {
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

export function buildGraph(files: string[], root: string) {
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
   RECORDER CLASS
---------------------------------------------------- */

export class Recorder {
  private isRecording = false;
  private recordingStartTime = 0;
  private sessionEvents: any[] = [];
  private sessionId: string = '';
  private soxProcess: ChildProcessWithoutNullStreams | null = null;
  private recordingDecoration: vscode.TextEditorDecorationType;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    this.recordingDecoration = vscode.window.createTextEditorDecorationType({
      gutterIconPath: context.asAbsolutePath('media/mic.svg'),
      gutterIconSize: 'contain',
      backgroundColor: 'rgba(255, 200, 0, 0.08)',
      overviewRulerColor: 'rgba(255, 200, 0, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  /* ----------------------------------------------------
     HIGHLIGHT RECORDED LINES
  ---------------------------------------------------- */

  highlightRecordedLines() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) return;

    const file = vscode.workspace.asRelativePath(editor.document.uri);
    const decorations: vscode.DecorationOptions[] = [];
    const highlightedLines = new Set<number>(); // Prevent duplicate highlights

    // 1. Gather historical events from ALL sessions
    let historicalEvents: any[] = [];
    const rewindFolder = path.join(workspace.uri.fsPath, '.rewind');
    
    if (fs.existsSync(rewindFolder)) {
      const jsonFiles = fs.readdirSync(rewindFolder)
        .filter(f => f.endsWith('.json'));

      // LOOP through every saved recording session
      for (const jsonFile of jsonFiles) {
        try {
          const session = JSON.parse(
            fs.readFileSync(path.join(rewindFolder, jsonFile), 'utf-8')
          );
          if (session.events) {
            historicalEvents.push(...session.events);
          }
        } catch (e) {
          console.error('Failed to parse history', e);
        }
      }
    }

    // 2. Combine history with the live active recording
    const allEvents = [...historicalEvents, ...this.sessionEvents];

    // 3. Apply the decorations
    allEvents.forEach((e: any) => {
      if (e.file !== file) return;
      if (e.line === undefined || e.line === null) return;
      if (typeof e.line !== 'number') return;
      if (e.line < 0 || e.line >= editor.document.lineCount) return;

      // Skip if we already highlighted this exact line
      if (highlightedLines.has(e.line)) return;
      highlightedLines.add(e.line);

      const range = new vscode.Range(
        e.line, 0,
        e.line, editor.document.lineAt(e.line).text.length
      );

      const args = encodeURIComponent(JSON.stringify([e.line]));
      const md = new vscode.MarkdownString(
        `🎙 **Click to hear explanation**\n\n[Play Recording](command:rewind.playForLine?${args})`
      );
      md.isTrusted = true;

      decorations.push({ range, hoverMessage: md });
    });

    editor.setDecorations(this.recordingDecoration, decorations);
  }

  /* ----------------------------------------------------
     AUDIO PLAYER
  ---------------------------------------------------- */

  openAudioPlayer(audioFile: string, timestamp: number) {
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
     PLAY FOR LINE
  ---------------------------------------------------- */

  playForLine(targetLine?: number) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) return;

    const file = vscode.workspace.asRelativePath(editor.document.uri);
    
    // Use the clicked line if it exists, otherwise fallback to the cursor position
    const line = targetLine !== undefined ? targetLine : editor.selection.active.line;

    const rewindFolder = path.join(workspace.uri.fsPath, '.rewind');

    if (!fs.existsSync(rewindFolder)) {
      vscode.window.showInformationMessage('No recordings found');
      return;
    }

    // Sort descending so we search the NEWEST recordings first
    const jsonFiles = fs.readdirSync(rewindFolder)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();

    if (jsonFiles.length === 0) {
      vscode.window.showInformationMessage('No recordings found');
      return;
    }

    let match: any = null;
    let matchedAudioFile: string = '';

    // Loop through files until we find the audio for this line
    for (const jsonFile of jsonFiles) {
      try {
        const session = JSON.parse(
          fs.readFileSync(path.join(rewindFolder, jsonFile), 'utf-8')
        );

        match = session.events?.find(
          (e: any) => e.file === file && e.line === line
        );

        if (match) {
          matchedAudioFile = session.audioFile;
          break; // Found it! Stop searching older files.
        }
      } catch (e) {
        console.error('Error reading session file', e);
      }
    }

    if (!match) {
      vscode.window.showInformationMessage('No explanation for this line');
      return;
    }

    this.openAudioPlayer(matchedAudioFile, match.timestamp);
  }

  /* ----------------------------------------------------
     START RECORDING
  ---------------------------------------------------- */

  startRecording() {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) {
      vscode.window.showErrorMessage('Open a folder first');
      return;
    }

    const rewindFolder = path.join(workspace.uri.fsPath, '.rewind');
    if (!fs.existsSync(rewindFolder)) {
      fs.mkdirSync(rewindFolder);
    }

    this.sessionId = Date.now().toString();
    const audioPath = path.join(rewindFolder, `${this.sessionId}.wav`);

    this.isRecording = true;
    this.recordingStartTime = Date.now();
    this.sessionEvents = [];

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      this.sessionEvents.push({
        file: vscode.workspace.asRelativePath(editor.document.uri),
        line: editor.selection.active.line,
        timestamp: 0
      });
      // TRIGGER UI UPDATE
      this.highlightRecordedLines();
    }

    const isWindows = process.platform === 'win32';

    try {
      this.soxProcess = spawn('sox', [
        ...(isWindows ? ['-t', 'waveaudio', '0'] : ['-d']),
        '-c', '1',
        '-r', '16000',
        audioPath
      ]);

      this.soxProcess.stderr.on('data', (data) => {
        console.log(`SoX stderr: ${data}`);
      });

      this.soxProcess.on('error', (err) => {
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

  /* ----------------------------------------------------
     STOP RECORDING
  ---------------------------------------------------- */

  stopRecording() {
    if (!this.isRecording || !this.soxProcess) {
      vscode.window.showErrorMessage('No active recording');
      return;
    }

    this.isRecording = false;

    this.soxProcess.kill('SIGINT');
    this.soxProcess = null;

    const workspace = vscode.workspace.workspaceFolders?.[0];
    if (!workspace) return;

    const rewindFolder = path.join(workspace.uri.fsPath, '.rewind');
    const metadata = {
      sessionId: this.sessionId,
      audioFile: `${this.sessionId}.wav`,
      events: this.sessionEvents
    };

    setTimeout(() => {
      fs.writeFileSync(
        path.join(rewindFolder, `${this.sessionId}.json`),
        JSON.stringify(metadata, null, 2)
      );

      const audioPath = path.join(rewindFolder, `${this.sessionId}.wav`);
      const wavExists = fs.existsSync(audioPath);

      vscode.window.showInformationMessage(
        wavExists
          ? '🧠 Thought recording saved successfully'
          : '⚠️ JSON saved but WAV file missing — is SoX installed?'
      );

      this.highlightRecordedLines();
    }, 500);
  }

  /* ----------------------------------------------------
     TRACK CHANGES (Typing)
  ---------------------------------------------------- */

  trackChange(event: vscode.TextDocumentChangeEvent) {
    if (!this.isRecording) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    if (!event.contentChanges || event.contentChanges.length === 0) return;

    const file = vscode.workspace.asRelativePath(event.document.uri);
    const line = event.contentChanges[0]?.range.start.line;

    if (line === undefined) return;

    this.sessionEvents.push({
      file,
      line,
      timestamp: Date.now() - this.recordingStartTime
    });
    
    // TRIGGER UI UPDATE
    this.highlightRecordedLines();
  }

  /* ----------------------------------------------------
     TRACK SELECTION (Clicking/Cursor Movement)
  ---------------------------------------------------- */

  trackSelection(event: vscode.TextEditorSelectionChangeEvent) {
    if (!this.isRecording) return;
    if (event.selections.length === 0) return;

    const file = vscode.workspace.asRelativePath(event.textEditor.document.uri);
    const line = event.selections[0].active.line;

    // Prevent spamming the array if they click the exact same line 10 times in a row
    const lastEvent = this.sessionEvents[this.sessionEvents.length - 1];
    if (lastEvent && lastEvent.file === file && lastEvent.line === line) return;

    this.sessionEvents.push({
      file,
      line,
      timestamp: Date.now() - this.recordingStartTime
    });

    // TRIGGER UI UPDATE
    this.highlightRecordedLines();
  }
}

/* ----------------------------------------------------
   WEBVIEW UI
---------------------------------------------------- */

export function getWebviewContent(): string {
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