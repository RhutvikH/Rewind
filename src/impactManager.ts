import * as vscode from 'vscode';
import { updateImpactDecorations } from './decorations';
import { ImpactAlert } from './types';

// Map of URI string -> Array of alerts for that file
export const activeAlerts = new Map<string, ImpactAlert[]>();

export async function analyzeImpact(document: vscode.TextDocument) {
    // Clear previous impact alerts on new saves
    activeAlerts.clear();

    const symbolsToSearch: vscode.Position[] = [];
    // Matches the core exported blocks inside TS/JS files
    const exportRegex = /export\s+(?:async\s+)?(?:function|class|interface|type|const|let|var)\s+([a-zA-Z0-9_$]+)/g;

    for (let i = 0; i < document.lineCount; i++) {
        const lineText = document.lineAt(i).text;
        let match;
        while ((match = exportRegex.exec(lineText)) !== null) {
            // Find the precise column start of the actual variable name
            const symbolIndex = match.index + match[0].lastIndexOf(match[1]);
            symbolsToSearch.push(new vscode.Position(i, symbolIndex));
        }
    }

    if (symbolsToSearch.length === 0) return;

    let affectedCount = 0;
    const originalUriStr = document.uri.toString();

    for (const pos of symbolsToSearch) {
        try {
            // Ping the native VS Code TypeScript Language Server to hunt for all dependencies instantly
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                document.uri,
                pos
            );

            if (locations) {
                for (const loc of locations) {
                    const locUriStr = loc.uri.toString();
                    
                    // Highlight non-local dependencies ONLY (files other than the one just saved)
                    if (locUriStr !== originalUriStr) {
                        if (!activeAlerts.has(locUriStr)) {
                            activeAlerts.set(locUriStr, []);
                        }
                        
                        const existing = activeAlerts.get(locUriStr)!;
                        // Avoid duplicate UI decorations if multiple exports trigger the exact same referenced block
                        const isDup = existing.some(a => a.range.isEqual(loc.range));
                        if (!isDup) {
                            existing.push({
                                uri: loc.uri,
                                range: loc.range,
                                message: `May be indirectly affected by recent changes in \`${vscode.workspace.asRelativePath(document.uri)}\``
                            });
                            affectedCount++;
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Impact analysis error:', e);
        }
    }

    if (affectedCount > 0) {
        const fileWord = affectedCount === 1 ? 'location' : 'locations';
        vscode.window.showInformationMessage(`Rewind: Change Impact Alert! ${affectedCount} ${fileWord} outside this file may be structurally affected by your recent save.`);
        
        // Immediately repaint any visible editors if they happen to be the impacted files
        for (const editor of vscode.window.visibleTextEditors) {
            updateImpactDecorations(editor);
        }
    } else {
        // Clear old decorations in an edge-case where the user deletes their connections
        for (const editor of vscode.window.visibleTextEditors) {
            updateImpactDecorations(editor);
        }
    }
}
