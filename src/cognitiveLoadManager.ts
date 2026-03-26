import * as vscode from "vscode";
import { LineMetrics } from "./types";
import { CognitiveLoadStrategy } from "./strategies/CognitiveLoadStrategy";
import { DeletionsAndPausesStrategy } from "./strategies/DeletionsAndPausesStrategy";

export class CognitiveLoadManager {
  // Map of fileName -> array of LineMetrics where array index = line number
  private fileMetrics: Map<string, LineMetrics[]> = new Map();

  private currentCursorLine: number | null = null;
  private currentCursorFile: string | null = null;
  private dwellTimer: NodeJS.Timeout | null = null;
  private repaintCallback: (() => void) | null = null;
  private strategy: CognitiveLoadStrategy;
  private lastEditTime: number = 0;

  constructor(strategy?: CognitiveLoadStrategy) {
    this.strategy = strategy || new DeletionsAndPausesStrategy();
  }

  public setStrategy(strategy: CognitiveLoadStrategy) {
    this.strategy = strategy;
  }

  public setRepaintCallback(cb: () => void) {
    this.repaintCallback = cb;
  }

  public getMetrics(file: string): LineMetrics[] {
    return this.fileMetrics.get(file) || [];
  }

  private getOrInitLineMetrics(
    file: string,
    linesCount: number,
  ): LineMetrics[] {
    if (!this.fileMetrics.has(file)) {
      const arr = Array.from({ length: linesCount }, () =>
        this.createEmptyMetrics(),
      );
      this.fileMetrics.set(file, arr);
    }
    return this.fileMetrics.get(file)!;
  }

  private createEmptyMetrics(): LineMetrics {
    return {
      deletions: 0,
      editCount: 0,
      dwellTimeMs: 0,
      totalScore: 0,
    };
  }

  // calculateScore is now handled by CognitiveLoadStrategy

  public onDocumentChange(event: vscode.TextDocumentChangeEvent) {
    this.lastEditTime = Date.now();
    const file = event.document.fileName;
    const metrics = this.getOrInitLineMetrics(file, event.document.lineCount);

    // Sort changes reverse line-order to modify array back-to-front without index shifting bugs
    const changes = [...event.contentChanges].sort(
      (a, b) => b.range.start.line - a.range.start.line,
    );

    for (const change of changes) {
      const startLine = change.range.start.line;
      const endLine = change.range.end.line;

      const deletedLines = endLine - startLine;
      const addedLines = change.text.split("\n").length - 1;

      if (deletedLines > 0 || addedLines > 0) {
        // Lines were removed
        metrics.splice(startLine + 1, deletedLines);

        // Lines were added (insert empty metrics for new lines)
        const newItems = Array.from({ length: addedLines }, () =>
          this.createEmptyMetrics(),
        );
        metrics.splice(startLine + 1, 0, ...newItems);
      }

      // Record edit activity if within bounds
      if (startLine >= metrics.length) continue;
      if (!metrics[startLine]) metrics[startLine] = this.createEmptyMetrics();

      if (change.rangeLength > 0) {
        // If text was removed, it's a deletion
        metrics[startLine].deletions += 1;
      }
      if (change.text !== "") {
        // If text was added, it's an edit
        metrics[startLine].editCount += 1;
      }

      metrics[startLine].totalScore = this.strategy.calculateScore(
        metrics[startLine],
      );
    }
  }

  public onSelectionChange(event: vscode.TextEditorSelectionChangeEvent) {
    if (event.selections.length === 0) return;

    const editor = event.textEditor;
    const line = event.selections[0].active.line;
    const file = editor.document.fileName;

    if (this.currentCursorFile === file && this.currentCursorLine === line) {
      // Unchanged line
      return;
    }

    this.startDwellTracking(file, line, editor.document.lineCount);
  }

  private startDwellTracking(
    file: string,
    line: number,
    documentLineCount: number,
  ) {
    if (this.dwellTimer) clearInterval(this.dwellTimer);

    this.currentCursorFile = file;
    this.currentCursorLine = line;

    this.dwellTimer = setInterval(() => {
      if (this.currentCursorFile && this.currentCursorLine !== null) {
        const metrics = this.getOrInitLineMetrics(
          this.currentCursorFile,
          documentLineCount,
        );
        if (this.currentCursorLine < metrics.length) {
          if (!metrics[this.currentCursorLine]) {
            metrics[this.currentCursorLine] = this.createEmptyMetrics();
          }

          // Only increase dwell time if there hasn't been an edit in the last 1 second.
          // This prevents continuous typing from artificially inflating the cognitive load.
          if (Date.now() - this.lastEditTime >= 1000) {
            metrics[this.currentCursorLine].dwellTimeMs += 1000;
          }

          metrics[this.currentCursorLine].totalScore =
            this.strategy.calculateScore(metrics[this.currentCursorLine]);

          if (this.repaintCallback) {
            this.repaintCallback();
          }
        }
      }
    }, 1000); // Pulse every 1s
  }

  public dispose() {
    if (this.dwellTimer) clearInterval(this.dwellTimer);
  }
}
