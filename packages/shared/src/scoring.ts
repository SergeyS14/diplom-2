export interface ScoreInput {
  isCorrect: boolean;
  timeMs: number;
  timeLimitMs: number;
  base: number;
  streak: number;
}

/** Kahoot-подобная формула: база + бонус за скорость + стрик. */
export function calcPoints({
  isCorrect,
  timeMs,
  timeLimitMs,
  base,
  streak,
}: ScoreInput): number {
  if (!isCorrect) {
    return 0;
  }

  const clamped = Math.min(Math.max(timeMs, 0), timeLimitMs);
  const speed = 1 - clamped / timeLimitMs;
  const speedBonus = Math.round(base * 0.5 * speed);
  const streakBonus = Math.min(Math.max(streak, 0), 5) * 50;

  return base + speedBonus + streakBonus;
}
