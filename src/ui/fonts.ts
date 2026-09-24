// SPDX-License-Identifier: GPL-3.0-only

/** Resolve once web fonts are ready, or after timeoutMs, whichever comes first. */
export async function waitForFonts(timeoutMs: number): Promise<void> {
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([document.fonts.ready.then(() => undefined), timeout]);
}
