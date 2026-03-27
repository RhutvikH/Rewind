import * as vscode from 'vscode';

export interface ImpactAlert {
    uri: vscode.Uri;
    range: vscode.Range;
    sourceUri: string;    // URI string of the file whose save triggered this alert
    symbolName: string;   // Exported symbol name that changed (e.g. "myFunction")
    message: string;
}
