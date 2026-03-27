import * as vscode from 'vscode';
import { activeAlerts, clearAllAlerts, getLastAnalysisSummary } from './impactManager';

let _panel: vscode.WebviewPanel | undefined;

export function showImpactResultsPanel(context: vscode.ExtensionContext): void {
    if (_panel) {
        _panel.reveal(vscode.ViewColumn.Beside, true);
        _panel.webview.html = buildHtml(_panel.webview);
        return;
    }

    _panel = vscode.window.createWebviewPanel(
        'rewind.impactResults',
        'Impact Analysis',
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: []
        }
    );

    _panel.webview.html = buildHtml(_panel.webview);

    _panel.webview.onDidReceiveMessage(async (msg) => {
        switch (msg.command) {
            case 'jump': {
                try {
                    const uri = vscode.Uri.parse(msg.uriStr as string);
                    const r = msg.range as { sl: number; sc: number; el: number; ec: number };
                    const range = new vscode.Range(r.sl, r.sc, r.el, r.ec);
                    const doc = await vscode.workspace.openTextDocument(uri);
                    const editor = await vscode.window.showTextDocument(doc, {
                        viewColumn: vscode.ViewColumn.One,
                        preview: false,
                        preserveFocus: false
                    });
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    editor.selection = new vscode.Selection(range.start, range.start);
                } catch (e) {
                    console.error('Rewind: failed to jump to location', e);
                }
                break;
            }
            case 'clearAll': {
                clearAllAlerts();
                break;
            }
            case 'rerun': {
                await vscode.commands.executeCommand('rewind.analyzeImpact');
                break;
            }
        }
    }, undefined, context.subscriptions);

    _panel.onDidDispose(() => { _panel = undefined; }, undefined, context.subscriptions);
}

export function refreshResultsPanel(): void {
    if (_panel) {
        _panel.webview.html = buildHtml(_panel.webview);
    }
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const summary = getLastAnalysisSummary();

    const affectedEntries = [...activeAlerts.entries()]
        .filter(([, alerts]) => alerts.length > 0)
        .sort(([, a], [, b]) => b.length - a.length);

    const hasAlerts = affectedEntries.length > 0;

    // ── Summary section ──
    let summarySection: string;
    if (summary && hasAlerts) {
        const locWord = summary.affectedCount === 1 ? 'location' : 'locations';
        const fileWord = summary.fileCount === 1 ? 'file' : 'files';
        summarySection = `
            <div class="summary warning">
                <div class="summary-label">Impact detected</div>
                <div class="summary-stat">
                    <span class="stat-num">${summary.affectedCount}</span> ${locWord}
                    across <span class="stat-num">${summary.fileCount}</span> ${fileWord}
                </div>
                <div class="summary-source">
                    Changes to <code>${escHtml(summary.sourceRelPath)}</code>
                </div>
                <div class="summary-time">Analysed at ${formatTime(summary.ranAt)}</div>
            </div>`;
    } else {
        summarySection = `
            <div class="summary clean">
                <div class="summary-label">No impact detected</div>
                <div class="summary-source">The last analysis found no cross-file references affected.</div>
            </div>`;
    }

    // ── File groups ──
    const fileGroupsHtml = affectedEntries.map(([uriStr, alerts]) => {
        const relPath = vscode.workspace.asRelativePath(vscode.Uri.parse(uriStr));
        const rows = alerts.map((alert, idx) => {
            const lineNum = alert.range.start.line + 1;
            // Encode range as compact flat numbers to avoid quoting issues in data attributes
            const rangeData = `${alert.range.start.line}:${alert.range.start.character}:${alert.range.end.line}:${alert.range.end.character}`;
            const safeUri = escHtmlAttr(uriStr);
            return `<tr>
                <td class="col-num">${idx + 1}</td>
                <td class="col-symbol"><code>${escHtml(alert.symbolName)}</code></td>
                <td class="col-line">L${lineNum}</td>
                <td class="col-detail">${escHtml(alert.message)}</td>
                <td class="col-action">
                    <button class="btn btn-go js-jump"
                        data-uri="${safeUri}"
                        data-range="${rangeData}">Go to</button>
                </td>
            </tr>`;
        }).join('\n');

        return `<div class="file-group">
            <div class="file-header">
                <span class="file-path">${escHtml(relPath)}</span>
                <span class="file-count">${alerts.length}</span>
            </div>
            <table class="alert-table">
                <thead><tr>
                    <th>#</th><th>Symbol</th><th>Line</th><th>Details</th><th></th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Impact Analysis</title>
    <style nonce="${nonce}">
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: var(--vscode-font-family, system-ui, -apple-system, sans-serif);
            font-size: var(--vscode-font-size, 13px);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* ── Top bar ── */
        .topbar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 10px 16px;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
            background: var(--vscode-sideBar-background, var(--vscode-editor-background));
            flex-shrink: 0;
        }
        .topbar-title {
            flex: 1;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            opacity: 0.7;
        }
        .btn {
            cursor: pointer;
            border: 1px solid transparent;
            border-radius: 3px;
            padding: 4px 10px;
            font-size: 12px;
            font-family: inherit;
            line-height: 1.4;
            transition: opacity 0.1s;
            white-space: nowrap;
        }
        .btn:active { opacity: 0.7; }
        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: var(--vscode-button-background);
        }
        .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-secondaryBackground)); opacity: 0.85; }
        .btn-go {
            background: transparent;
            color: var(--vscode-textLink-foreground);
            border-color: var(--vscode-textLink-foreground);
            padding: 2px 8px;
            font-size: 11px;
        }
        .btn-go:hover { background: var(--vscode-textLink-foreground); color: var(--vscode-button-foreground); }

        /* ── Scrollable body ── */
        .content {
            flex: 1;
            overflow-y: auto;
            padding: 14px 16px 24px;
        }

        /* ── Summary ── */
        .summary {
            border-radius: 4px;
            border: 1px solid;
            padding: 12px 14px;
            margin-bottom: 16px;
        }
        .summary.warning {
            border-color: var(--vscode-inputValidation-warningBorder, rgba(205,149,40,0.6));
            background: var(--vscode-inputValidation-warningBackground, rgba(205,149,40,0.08));
        }
        .summary.clean {
            border-color: var(--vscode-panel-border, rgba(255,255,255,0.1));
            background: transparent;
        }
        .summary-label {
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            opacity: 0.55;
            margin-bottom: 4px;
        }
        .summary-stat {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .stat-num {
            color: var(--vscode-inputValidation-warningBorder, #cd9528);
            font-size: 18px;
        }
        .summary-source {
            font-size: 12px;
            opacity: 0.75;
            margin-bottom: 2px;
        }
        .summary-source code {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 11px;
            background: rgba(255,255,255,0.06);
            border-radius: 2px;
            padding: 0 3px;
        }
        .summary-time {
            font-size: 11px;
            opacity: 0.45;
            margin-top: 4px;
        }

        /* ── Analysed-file heading ── */
        .source-heading {
            padding: 8px 16px 10px;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
            background: var(--vscode-sideBar-background, var(--vscode-editor-background));
            flex-shrink: 0;
        }
        .source-heading-label {
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.07em;
            opacity: 0.45;
            margin-bottom: 2px;
        }
        .source-heading-path {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 13px;
            font-weight: 600;
            opacity: 0.95;
            word-break: break-all;
        }

        /* ── File groups ── */
        .file-group {
            border: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
            border-radius: 4px;
            margin-bottom: 12px;
            overflow: hidden;
        }
        .file-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 12px;
            background: var(--vscode-sideBarSectionHeader-background,
                        var(--vscode-sideBar-background,
                        rgba(255,255,255,0.03)));
            border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
        }
        .file-path {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            flex: 1;
            opacity: 0.9;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .file-count {
            font-size: 11px;
            font-weight: 600;
            padding: 1px 7px;
            border-radius: 10px;
            background: var(--vscode-badge-background, rgba(205,149,40,0.2));
            color: var(--vscode-badge-foreground, #cd9528);
            flex-shrink: 0;
        }

        /* ── Alert table ── */
        .alert-table {
            width: 100%;
            border-collapse: collapse;
        }
        .alert-table th {
            font-size: 11px;
            font-weight: 500;
            opacity: 0.45;
            text-align: left;
            padding: 5px 10px;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));
        }
        .alert-table td {
            padding: 6px 10px;
            vertical-align: middle;
            border-bottom: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.05));
        }
        .alert-table tbody tr:last-child td { border-bottom: none; }
        .alert-table tbody tr:hover td {
            background: var(--vscode-list-hoverBackground, rgba(255,255,255,0.04));
        }
        .col-num    { width: 28px; font-size: 11px; opacity: 0.35; text-align: right; }
        .col-symbol { width: 130px; }
        .col-symbol code {
            font-family: var(--vscode-editor-font-family, monospace);
            font-size: 12px;
            background: rgba(255,255,255,0.06);
            padding: 1px 5px;
            border-radius: 2px;
        }
        .col-line   { width: 44px; font-family: monospace; font-size: 11px; opacity: 0.55; }
        .col-detail { font-size: 12px; opacity: 0.8; }
        .col-action { width: 70px; text-align: right; }
    </style>
</head>
<body>
    <div class="topbar">
        <span class="topbar-title">Change Impact Analysis</span>
        <button class="btn btn-primary js-rerun">Re-run</button>
        ${hasAlerts ? `<button class="btn btn-secondary js-clear">Clear</button>` : ''}
    </div>

    ${summary ? `
    <div class="source-heading">
        <div class="source-heading-label">Analysed file</div>
        <div class="source-heading-path">${escHtml(summary.sourceRelPath)}</div>
    </div>` : ''}

    <div class="content">
        ${summarySection}
        ${fileGroupsHtml}
    </div>

    <script nonce="${nonce}">
        // Use event delegation — onclick attributes are blocked by CSP nonce policy
        const vscode = acquireVsCodeApi();

        document.addEventListener('click', function(e) {
            const target = e.target;
            if (!target || !(target instanceof Element)) { return; }
            const btn = target.closest('button');
            if (!btn) { return; }

            if (btn.classList.contains('js-jump')) {
                const uriStr  = btn.getAttribute('data-uri');
                const rawRange = btn.getAttribute('data-range') || '';
                // Format: "startLine:startChar:endLine:endChar"
                const parts = rawRange.split(':').map(Number);
                vscode.postMessage({
                    command: 'jump',
                    uriStr: uriStr,
                    range: { sl: parts[0], sc: parts[1], el: parts[2], ec: parts[3] }
                });
            }
            else if (btn.classList.contains('js-clear')) {
                vscode.postMessage({ command: 'clearAll' });
            }
            else if (btn.classList.contains('js-rerun')) {
                vscode.postMessage({ command: 'rerun' });
            }
        });
    </script>
</body>
</html>`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escHtmlAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(d: Date): string {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
