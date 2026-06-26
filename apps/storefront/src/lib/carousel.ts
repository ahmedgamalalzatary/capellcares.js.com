/**
 * Pure helpers for a one-at-a-time sliding carousel: a window of `visible`
 * cards that advances by a single card per step (not by a whole page).
 */

/** Largest valid start index — the last position where a full window still fits. */
export function maxStart(total: number, visible: number): number {
  return Math.max(0, total - visible);
}

/** Clamp a start index into the valid `[0, maxStart]` range. */
export function clampStart(start: number, total: number, visible: number): number {
  return Math.min(Math.max(0, start), maxStart(total, visible));
}

/**
 * Transform for the flex track. The track is as wide as the viewport and holds
 * all cards (each `100 / visible`% wide), so shifting by one card means moving
 * `100 / visible`% of the track width per step.
 */
export function trackTransform(start: number, visible: number): string {
  return `translateX(-${start * (100 / visible)}%)`;
}
