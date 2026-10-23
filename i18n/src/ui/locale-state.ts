import type { SupportedLocale } from "../types.js";

/**
 * Locale and epoch shared by every render-time translation seam.
 *
 * State lives on `globalThis`: omp may load the same plugin through both
 * `extensions:` and a linked plugin directory, which gives each load its own
 * module graph. A shared cell keeps `/lang` effective for every instance and
 * avoids translating a string twice (inner instance zh, outer instance en).
 */
interface LocaleState {
  locale: SupportedLocale;
  epoch: number;
}

const STATE_KEY = Symbol.for("omp.i18n.localeState");

function state(): LocaleState {
  const host = globalThis as unknown as Record<symbol, LocaleState | undefined>;
  let current = host[STATE_KEY];
  if (!current) {
    current = { locale: "en", epoch: 0 };
    host[STATE_KEY] = current;
  }
  return current;
}

export function getUiLocale(): SupportedLocale {
  return state().locale;
}

export function setUiLocale(next: SupportedLocale): void {
  const current = state();
  if (next === current.locale) return;
  current.locale = next;
  current.epoch++;
}

/** Force memoized translations to be rebuilt (e.g. `/lang reload`). */
export function bumpUiEpoch(): void {
  state().epoch++;
}

export function getUiEpoch(): number {
  return state().epoch;
}
