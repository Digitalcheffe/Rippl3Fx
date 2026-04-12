import { WEIGHTS } from './weights';
import { normalizeValue, getHistoricalPeak } from './normalize';

/**
 * Compute interest score for a tracked item based on its current metrics.
 * Normalizes each metric against its historical peak, applies weights, returns 0–100.
 */
export function computeInterestScore(
  trackedItemId: number,
  platform: string,
  metrics: Record<string, number>
): number {
  const platformWeights = WEIGHTS[platform];
  if (!platformWeights) return 0;

  let score = 0;

  for (const [metric, weight] of Object.entries(platformWeights)) {
    const value = metrics[metric] ?? 0;
    const peak = getHistoricalPeak(trackedItemId, platform, metric);
    const normalized = normalizeValue(value, peak);
    score += normalized * weight;
  }

  return Math.round(score * 100) / 100;
}
