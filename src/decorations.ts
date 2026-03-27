import * as vscode from 'vscode';
import { activeAlerts } from './impactManager';

let impactDeco: vscode.TextEditorDecorationType | undefined;

export function initImpactDecorations(): vscode.TextEditorDecorationType {
    impactDeco = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 165, 0, 0.18)', // Soft orange warning glow
        borderWidth: '0 0 2px 0',
        borderColor: 'rgba(255, 140, 0, 0.85)',
        borderStyle: 'solid',
        overviewRulerColor: 'rgba(255, 140, 0, 0.8)',
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        isWholeLine: false
    });
    return impactDeco;
}

export function updateImpactDecorations(editor: vscode.TextEditor) {
    if (!editor || !impactDeco) { return; }

    const uriStr = editor.document.uri.toString();
    const alerts = activeAlerts.get(uriStr) || [];

    const options: vscode.DecorationOptions[] = alerts.map(alert => ({
        range: alert.range,
        hoverMessage: new vscode.MarkdownString(
            `**Change Impact Alert**\n\n` +
            `Symbol \`${alert.symbolName}\` was modified.\n\n` +
            `${alert.message}\n\n` +
            `*Run **Rewind: Show Impact Analysis Results** for details.*`
        )
    }));

    editor.setDecorations(impactDeco, options);
}

import { getGhostBlocks } from './ghostBranchManager';

let originalDeco: vscode.TextEditorDecorationType;
let ghostDeco: vscode.TextEditorDecorationType;
let markerDeco: vscode.TextEditorDecorationType;

export function initGhostDecorations(context: vscode.ExtensionContext) {
    originalDeco = vscode.window.createTextEditorDecorationType({
        opacity: '0.4',
        isWholeLine: true,
        textDecoration: 'line-through'
    });
    
    ghostDeco = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 128, 0.08)',
        isWholeLine: true
    });

    markerDeco = vscode.window.createTextEditorDecorationType({
        color: '#888888',
        fontStyle: 'italic',
        fontWeight: 'bold',
        isWholeLine: true,
        backgroundColor: 'rgba(0,0,0,0.1)'
    });
}

export function updateGhostDecorations(editor: vscode.TextEditor) {
    if (!editor) return;

    const blocks = getGhostBlocks(editor.document);
    
    const origOptions: vscode.DecorationOptions[] = [];
    const ghostOptions: vscode.DecorationOptions[] = [];
    const markerOptions: vscode.DecorationOptions[] = [];

    for (const block of blocks) {
        // Markers
        markerOptions.push({ range: editor.document.lineAt(block.origStartLine).range });
        markerOptions.push({ range: editor.document.lineAt(block.ghostStartLine).range });
        markerOptions.push({ range: editor.document.lineAt(block.ghostEndLine).range });

        // Original body
        if (block.ghostStartLine - block.origStartLine > 1) {
            const startPos = editor.document.lineAt(block.origStartLine + 1).range.start;
            const endPos = editor.document.lineAt(block.ghostStartLine - 1).range.end;
            origOptions.push({ range: new vscode.Range(startPos, endPos) });
        }

        // Ghost body
        if (block.ghostEndLine - block.ghostStartLine > 1) {
            const startPos = editor.document.lineAt(block.ghostStartLine + 1).range.start;
            const endPos = editor.document.lineAt(block.ghostEndLine - 1).range.end;
            ghostOptions.push({ range: new vscode.Range(startPos, endPos) });
        }
    }

    editor.setDecorations(originalDeco, origOptions);
    editor.setDecorations(ghostDeco, ghostOptions);
    editor.setDecorations(markerDeco, markerOptions);
import * as vscode from "vscode";
import { CognitiveLoadManager } from "./cognitiveLoadManager";

let gradientDecorations: vscode.TextEditorDecorationType[] = [];
const GRADIENT_STEPS = 20;

export function initHeatmapDecorations() {
  for (let i = 0; i <= GRADIENT_STEPS; i++) {
    const ratio = i / GRADIENT_STEPS;
    // Interpolate green from 255 (yellow) down to 0 (red)
    const r = 255;
    const g = Math.floor(255 * (1 - ratio));
    const b = 0;
    // Alpha scales up to 0.6 at maximum tension
    const a = (0.6 * ratio).toFixed(2);

    gradientDecorations.push(
      vscode.window.createTextEditorDecorationType({
        backgroundColor: `rgba(${r}, ${g}, ${b}, ${a})`,
        isWholeLine: true,
      }),
    );
  }
}

export function updateHeatmapDecorations(
  editor: vscode.TextEditor,
  manager: CognitiveLoadManager | null,
) {
  if (!editor) return;

  if (!manager) {
    gradientDecorations.forEach((dec) => editor.setDecorations(dec, []));
    return;
  }

  const file = editor.document.fileName;
  const metricsArr = manager.getMetrics(file);

  const decOptions: vscode.DecorationOptions[][] = Array.from(
    { length: GRADIENT_STEPS + 1 },
    () => [],
  );

  // 1. Calculate Spatial Smoothed Scores (Kernel: [0.2, 0.6, 0.2])
  const rawScores = metricsArr.map((m) => (m ? m.totalScore : 0));
  const smoothedScores: number[] = new Array(rawScores.length).fill(0);

  for (let i = 0; i < rawScores.length; i++) {
    const prev = i > 0 ? rawScores[i - 1] : rawScores[i];
    const next = i < rawScores.length - 1 ? rawScores[i + 1] : rawScores[i];
    const curr = rawScores[i];

    smoothedScores[i] = prev * 0.2 + curr * 0.6 + next * 0.2;
  }

  // 2. Assign Decorations
  for (let i = 0; i < metricsArr.length; i++) {
    const metrics = metricsArr[i];
    const smoothedScore = smoothedScores[i];

    // Skip unedited or zero-tension lines
    if (!metrics || smoothedScore < 0.5) continue;

    // Verify if line still exists in current text bounds
    if (i >= editor.document.lineCount) break;

    const maxChar = editor.document.lineAt(i).text.length;
    const range = new vscode.Range(i, 0, i, maxChar);

    const hoverMessage = new vscode.MarkdownString();
    hoverMessage.appendMarkdown(
      `**Cognitive Load**: ${metrics.totalScore.toFixed(1)} *(Blended: ${smoothedScore.toFixed(1)})*\n\n`,
    );
    hoverMessage.appendMarkdown(`- Edits: ${metrics.editCount}\n`);
    hoverMessage.appendMarkdown(`- Deletions: ${metrics.deletions}\n`);
    hoverMessage.appendMarkdown(
      `- Dwell Time: ${(metrics.dwellTimeMs / 1000).toFixed(1)}s\n`,
    );

    const decOpt = { range, hoverMessage };

    // Linear mapping up to GRADIENT_STEPS (score of 20 = purely red max)
    const decIndex = Math.max(
      0,
      Math.min(GRADIENT_STEPS, Math.floor(smoothedScore)),
    );

    decOptions[decIndex].push(decOpt);
  }

  // Apply the gradient decorations in bulk
  for (let i = 0; i <= GRADIENT_STEPS; i++) {
    editor.setDecorations(gradientDecorations[i], decOptions[i]);
  }
import * as vscode from 'vscode';
import { IntentManager } from './intentManager';

let intentDecorationType: vscode.TextEditorDecorationType;

export function reloadDecorationStyle() {
    if (intentDecorationType) {
        intentDecorationType.dispose();
    }
    const color = vscode.workspace.getConfiguration('rewind').get<string>('intentMarkerColor') || 'rgba(255, 255, 0, 0.2)';
    intentDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: color,
        isWholeLine: true,
        after: {
            margin: '0 0 0 3em',
            color: '#888',
            fontStyle: 'italic'
        }
    });
}

// Initial load
reloadDecorationStyle();

export function updateDecorations(editor: vscode.TextEditor, intentManager: IntentManager) {
    if (!editor || !intentDecorationType) {
        return;
    }

    const file = editor.document.fileName;
    const markers = intentManager.getMarkersForFile(file);

    // Group markers by line to prevent stacking overlapping decorations
    const markersByLine = new Map<number, typeof markers>();
    for (const marker of markers) {
        if (!markersByLine.has(marker.line)) markersByLine.set(marker.line, []);
        markersByLine.get(marker.line)!.push(marker);
    }

    const decorations: vscode.DecorationOptions[] = [];

    for (const [line, lineMarkers] of markersByLine.entries()) {
        const range = new vscode.Range(line, 0, line, 0);
        
        let hoverText = '';
        const labels = lineMarkers.map(m => m.intentLabel).join(', ');

        for (const marker of lineMarkers) {
            hoverText += `**Intent**: ${marker.intentLabel}\n\n`;
            if (marker.description) {
                hoverText += `*${marker.description}*\n\n`;
            }
            hoverText += `---\n\n`;
        }

        decorations.push({
            range,
            hoverMessage: new vscode.MarkdownString(hoverText),
            renderOptions: {
                after: {
                    contentText: `# ${labels}`
                }
            }
        });
    }

    editor.setDecorations(intentDecorationType, decorations);
}

export function clearDecorations(editor: vscode.TextEditor) {
    if (!editor || !intentDecorationType) return;
    editor.setDecorations(intentDecorationType, []);
}
import { PasteManager } from './pasteManager';

let pasteDecorationType: vscode.TextEditorDecorationType | undefined;

// Must be called from activate() after VS Code extension host is ready
export function initPasteDecorations() {
    if (pasteDecorationType) pasteDecorationType.dispose();
    pasteDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(0, 255, 0, 0.1)',
        isWholeLine: false,
        border: '1px dashed rgba(0, 255, 0, 0.3)'
    });
}

export function updatePasteDecorations(editor: vscode.TextEditor, pasteManager: PasteManager) {
    if (!editor || !pasteDecorationType) return;

    const file = editor.document.fileName;
    const pastedEvents = pasteManager.getPasteEvents(file);
    const decorations: vscode.DecorationOptions[] = [];

    for (const paste of pastedEvents) {
        const startLine = Math.max(0, paste.startLine);
        const maxEndLine = Math.min(Math.max(0, paste.endLine), editor.document.lineCount - 1);
        if (maxEndLine < startLine) continue;

        const range = new vscode.Range(
            new vscode.Position(startLine, 0),
            new vscode.Position(maxEndLine, editor.document.lineAt(maxEndLine).text.length)
        );

        const driftPercent = (paste.drift * 100).toFixed(1);
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.appendMarkdown(`**Source**: ${paste.source}\n\n`);
        hoverMessage.appendMarkdown(`**Drift**: ${driftPercent}%\n\n`);
        if (paste.originalText.trim().length > 0) {
            hoverMessage.appendMarkdown(`**Original text:**\n\n`);
            hoverMessage.appendCodeblock(paste.originalText, editor.document.languageId);
        }

        decorations.push({ range, hoverMessage });
    }

    editor.setDecorations(pasteDecorationType, decorations);
}
