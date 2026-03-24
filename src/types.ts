// The fundamental unit of time in Rewind
export interface RewindEvent {
    timestamp: number; // Unix timestamp
    type: 'intent_marker'; 
}

// 1. Intent Markers
export interface IntentMarkerEvent extends RewindEvent {
    type: 'intent_marker';
    file: string; // Absolute path
    line: number; // 0-indexed line number
    intentLabel: string; // e.g., "Refactoring", "Complex Logic"
    description?: string;
}