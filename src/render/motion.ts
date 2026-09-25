// SPDX-License-Identifier: GPL-3.0-only

/** Whether the player asked for less motion. Read live, so changing the OS setting applies at once. */
export type ReducedMotion = () => boolean;

export function watchReducedMotion(): ReducedMotion {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  return () => query.matches;
}
