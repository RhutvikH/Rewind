import * as vscode from 'vscode';
import { updateImpactDecorations } from './decorations';
import { ImpactAlert } from './types';

// Map of URI string -> Array of alerts for that file
export const activeAlerts = new Map<string, ImpactAlert[]>();

/** Stable summary from the last completed analysis run */
export interface AnalysisSummary {
    sourceRelPath: string;
    affectedCount: number;
    fileCount: number;
    ranAt: Date;
}

let _lastSummary: AnalysisSummary | null = null;

export function getLastAnalysisSummary(): AnalysisSummary | null {
    return _lastSummary;
}

export type AnalysisCompleteListener = (summary: AnalysisSummary | null) => void;
const _listeners = new Set<AnalysisCompleteListener>();

export function onAnalysisComplete(listener: AnalysisCompleteListener): vscode.Disposable {
    _listeners.add(listener);
    return { dispose: () => _listeners.delete(listener) };
}

function fireListeners(summary: AnalysisSummary | null): void {
    for (const fn of _listeners) { fn(summary); }
}

export function clearAllAlerts(): void {
    activeAlerts.clear();
    _lastSummary = null;
    for (const editor of vscode.window.visibleTextEditors) {
        updateImpactDecorations(editor);
    }
    fireListeners(null); // notify status bar & panel
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Export symbol extraction ─────────────────────────────────────────────────

interface SymbolRef { pos: vscode.Position; name: string; }

function extractExportedSymbols(document: vscode.TextDocument): SymbolRef[] {
    const results: SymbolRef[] = [];
    const seen = new Set<string>();

    // Pattern 1: named keyword exports
    // e.g. export [declare] [abstract] [async] function|class|interface|type|enum|const|let|var Name
    const namedRe = /export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?\s+|class\s+|interface\s+|type\s+|enum\s+|const\s+|let\s+|var\s+)([A-Za-z_$][A-Za-z0-9_$]*)/g;

    // Pattern 2: export default function/class with a name
    // e.g. export default function myFn() | export default class MyClass
    const defaultRe = /export\s+default\s+(?:async\s+)?(?:function\*?\s+|class\s+)([A-Za-z_$][A-Za-z0-9_$]*)/g;

    // Pattern 3: export { a, b as c, type d }
    // We extract local names (before 'as') to find their definition positions
    const listRe = /export\s+(?:type\s+)?\{([^}]+)\}/g;

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;

        namedRe.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = namedRe.exec(line)) !== null) {
            const name = m[1];
            const col = m.index + m[0].lastIndexOf(name);
            const key = `${i}:${col}:${name}`;
            if (!seen.has(key)) { seen.add(key); results.push({ pos: new vscode.Position(i, col), name }); }
        }

        defaultRe.lastIndex = 0;
        while ((m = defaultRe.exec(line)) !== null) {
            const name = m[1];
            const col = m.index + m[0].lastIndexOf(name);
            const key = `${i}:${col}:${name}`;
            if (!seen.has(key)) { seen.add(key); results.push({ pos: new vscode.Position(i, col), name }); }
        }

        listRe.lastIndex = 0;
        while ((m = listRe.exec(line)) !== null) {
            // Skip re-exports from other modules: export { foo } from './bar'
            const afterBrace = line.slice(line.indexOf('}', m.index) + 1).trim();
            if (/^from\s/.test(afterBrace)) { continue; }

            const entries = m[1].split(',');
            for (const entry of entries) {
                // "localName as exportedName" or just "name" or "type Name"
                const cleaned = entry.trim().replace(/^type\s+/, '');
                const parts = cleaned.split(/\s+as\s+/);
                const localName = parts[0].trim();
                if (!localName || /^['"]/.test(localName)) { continue; }
                const idx = line.indexOf(localName, m.index);
                if (idx === -1) { continue; }
                const key = `${i}:${idx}:${localName}`;
                if (!seen.has(key)) { seen.add(key); results.push({ pos: new vscode.Position(i, idx), name: localName }); }
            }
        }
    }

    return results;
}

// ─── Main analysis function ───────────────────────────────────────────────────

export async function analyzeImpact(document: vscode.TextDocument): Promise<void> {
    const originUriStr = document.uri.toString();
    const relPath = vscode.workspace.asRelativePath(document.uri);

    // Clear stale alerts for this source file and any downstream alerts it caused
    activeAlerts.delete(originUriStr);
    for (const [key, alerts] of activeAlerts.entries()) {
        const filtered = alerts.filter(a => a.sourceUri !== originUriStr);
        if (filtered.length === 0) { activeAlerts.delete(key); }
        else { activeAlerts.set(key, filtered); }
    }

    // Wait for the language server to settle after the save
    await delay(700);

    // Extract exported symbols using multiple patterns
    const symbols = extractExportedSymbols(document);

    if (symbols.length === 0) {
        for (const editor of vscode.window.visibleTextEditors) { updateImpactDecorations(editor); }
        _lastSummary = null;
        fireListeners(null);
        return;
    }

    let affectedCount = 0;

    await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Window, title: 'Rewind: Analyzing change impact...' },
        async (progress) => {
            for (let idx = 0; idx < symbols.length; idx++) {
                const { pos, name } = symbols[idx];
                progress.report({
                    message: `Checking '${name}' (${idx + 1}/${symbols.length})...`,
                    increment: 100 / symbols.length
                });

                try {
                    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                        'vscode.executeReferenceProvider',
                        document.uri,
                        pos
                    );
                    if (!locations || locations.length === 0) { continue; }

                    for (const loc of locations) {
                        const locUriStr = loc.uri.toString();
                        if (locUriStr === originUriStr) { continue; } // skip self-references

                        if (!activeAlerts.has(locUriStr)) { activeAlerts.set(locUriStr, []); }
                        const existing = activeAlerts.get(locUriStr)!;

                        // Deduplicate by range
                        const isDup = existing.some(a => a.range.isEqual(loc.range));
                        if (!isDup) {
                            existing.push({
                                uri: loc.uri,
                                range: loc.range,
                                sourceUri: originUriStr,
                                symbolName: name,
                                message: `References '${name}' from '${relPath}', which was just modified. Verify it still works as expected.`
                            });
                            affectedCount++;
                        }
                    }
                } catch (e) {
                    console.error(`Rewind: reference lookup failed for '${name}'`, e);
                }
            }
        }
    );

    // Repaint all visible editors
    for (const editor of vscode.window.visibleTextEditors) { updateImpactDecorations(editor); }

    const affectedFileCount = [...activeAlerts.keys()].filter(k => k !== originUriStr).length;

    _lastSummary = affectedCount > 0 ? {
        sourceRelPath: relPath,
        affectedCount,
        fileCount: affectedFileCount,
        ranAt: new Date()
    } : null;

    fireListeners(_lastSummary);

    if (affectedCount > 0) {
        const locWord = affectedCount === 1 ? 'location' : 'locations';
        const fileWord = affectedFileCount === 1 ? 'file' : 'files';
        const msg = `Rewind: ${affectedCount} ${locWord} across ${affectedFileCount} ${fileWord} may be affected by changes to '${relPath}'.`;

        const choice = await vscode.window.showWarningMessage(msg, 'Show Results', 'Dismiss');
        if (choice === 'Show Results') {
            vscode.commands.executeCommand('rewind.showImpactResults');
        }
    }
}
