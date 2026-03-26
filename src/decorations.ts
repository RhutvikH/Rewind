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
}
