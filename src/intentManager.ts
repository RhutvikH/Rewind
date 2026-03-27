import * as vscode from 'vscode';
import { IntentMarkerEvent } from './types';

export class IntentManager {
    // In-memory store mapping file paths to their intent markers
    // Note: In a production version, you could serialize this Map to a `.rewind/intents.json` file in the workspace.
    private markers: Map<string, IntentMarkerEvent[]> = new Map();

    public addMarker(file: string, line: number, label: string, description?: string) {
        if (!this.markers.has(file)) {
            this.markers.set(file, []);
        }
        
        const markerEvent: IntentMarkerEvent = {
            type: 'intent_marker',
            timestamp: Date.now(),
            file,
            line,
            intentLabel: label,
            description
        };
        
        this.markers.get(file)!.push(markerEvent);
    }

    public getMarkersForFile(file: string): IntentMarkerEvent[] {
        return this.markers.get(file) || [];
    }

    public removeMarkersAtLine(file: string, line: number, timestamp?: number) {
        if (this.markers.has(file)) {
            const fileMarkers = this.markers.get(file)!;
            this.markers.set(file, fileMarkers.filter(m => {
                if (m.line !== line) {return true;} // Keep markers on other lines
                if (timestamp !== undefined && m.timestamp !== timestamp) {return true;} // Keep markers on the same line but different timestamp
                return false; // Remove!
            }));
        }
    }

    public removeMarkersByCategory(categories: readonly string[]) {
        for (const [file, fileMarkers] of this.markers.entries()) {
            this.markers.set(file, fileMarkers.filter(m => !categories.includes(m.intentLabel)));
        }
    }

    public getAllMarkers(): IntentMarkerEvent[] {
        let allMarkers: IntentMarkerEvent[] = [];
        for (const fileMarkers of this.markers.values()) {
            allMarkers.push(...fileMarkers);
        }
        return allMarkers;
    }
}