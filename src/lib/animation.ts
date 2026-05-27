// src/lib/animation.ts

/** Base durations in ms. All consumers multiply by the current store speed. */
export const DURATION = {
  calcFrame: 400,
  probeWalkPerToken: 90,
  keyDrop: 350,
  keyMigrate: 600,
  vnodeFanInPerToken: 50,
  cardEnter: 250,
  cardExit: 200,
} as const;

export const EASING = {
  default: [0.22, 1, 0.36, 1] as const, // ease-out cubic-ish (Framer "easeOut")
  drop: [0.34, 1.56, 0.64, 1] as const, // gentle overshoot for drops
};

/**
 * Helper for components: multiply a base duration by the current speed slider.
 * Speed = 4 means "play 4x as fast" — divide. Speed = 0.25 means "quarter speed" —
 * divide too (1 / 0.25 = 4x longer). So duration in seconds = base / 1000 / speed.
 */
export function scaledSeconds(baseMs: number, speed: number): number {
  return baseMs / 1000 / speed;
}
