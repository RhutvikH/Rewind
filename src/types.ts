import * as vscode from 'vscode';

export interface ImpactAlert {
    uri: vscode.Uri;
    range: vscode.Range;
    message: string;
}
