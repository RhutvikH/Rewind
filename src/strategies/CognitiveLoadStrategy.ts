import { LineMetrics } from '../types';

export interface CognitiveLoadStrategy {
    /**
     * Calculates the cognitive load score based on the provided metrics.
     */
    calculateScore(metrics: LineMetrics): number;
}