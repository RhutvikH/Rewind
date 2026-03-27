import { CognitiveLoadStrategy } from './CognitiveLoadStrategy';
import { LineMetrics } from '../types';

export class DeletionsAndPausesStrategy implements CognitiveLoadStrategy {
    public calculateScore(metrics: LineMetrics): number {
        // Grace period: First 5 seconds of dwell time don't count towards cognitive load
        // so it won't matter much if typing a long line.
        const effectiveDwellSeconds = Math.max(0, (metrics.dwellTimeMs - 5000) / 1000);
        
        // Focus more on backspaces/rewrites (weight: 5 per deletion)
        // and time spent has a much lesser weight (weight: 0.1 per second).
        return (metrics.deletions * 0.2) + (effectiveDwellSeconds * 0.1);
    }
}