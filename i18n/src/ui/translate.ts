import type { SupportedLocale, UiTextDictionary } from "../types.js";
import { loadLocaleBundle } from "../locales/index.js";
import { asNativeNode, isRecordObject } from "./guards.js";
import { getUiEpoch, getUiLocale } from "./locale-state.js";

/**
 * Render-time translation for host UI strings.
 *
 * Only strings produced by omp's own TUI components are candidates. Model
 * output, file contents, diffs, terminal output and math are never walked, and
 * every replacement is an exact phrase or an explicit pattern, so arbitrary
 * text cannot be rewritten by accident.
 */

/** Kinds that carry user/model content rather than chrome: never touched. */
const SKIP_KINDS: Record<string, true> = {
  md: true,
  code: true,
  diff: true,
  ansi: true,
  math: true,
  image: true,
  media: true,
  chart: true,
  table: true,
  input: true,
  editor: true,
  kbd: true,
  icon: true,
};

const LINE_CACHE_LIMIT = 4000;

interface CompiledText {
  epoch: number;
  phrases: Map<string, string>;
  textPhrases: Map<string, string>;
  chromeLinePhrases: Map<string, string>;
  frameLinePhrases: Map<string, string>;
  chromePattern: RegExp | null;
  framePattern: RegExp | null;
  patterns: RegExp[];
  replacements: string[];
  linePatterns: RegExp[];
  prefixes: Array<[string, string]>;
  linePrefixes: Array<[RegExp, string]>;
  toolLabels: Map<string, string>;
  lineCache: Map<string, string>;
}

let compiled: CompiledText | undefined;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPhrasePattern(phrases: Map<string, string>): RegExp | null {
  const keys = [...phrases.keys()].sort((a, b) => b.length - a.length);
  if (keys.length === 0) return null;
  // Longest first so "Approve and execute" wins over "Approve".
  const alternation = keys.map(escapeRegExp).join("|");
  // No leading boundary: a rendered label may follow an SGR sequence whose last
  // byte is a letter (e.g. `\x1b[2m`). Longest-first alternation plus the
  // trailing check keeps "Approve" from matching inside longer words/phrases.
  return new RegExp(`(?:${alternation})(?![A-Za-z0-9_])`, "g");
}

function buildLinePattern(source: string): RegExp {
  // Anchors only make sense for whole native strings; a rendered line may carry
  // ANSI or a spinner prefix, so the same rule is applied unanchored.
  const trimmed = source.replace(/^\^/, "").replace(/\$$/, "");
  return new RegExp(trimmed);
}

function compile(locale: SupportedLocale): CompiledText {
  const dictionary: UiTextDictionary = loadLocaleBundle(locale).uiText;
  const phraseEntries = Object.entries(dictionary.phrases ?? {});
  const chromeEntries = Object.entries(dictionary.chromePhrases ?? {});
  const toolLabelEntries = Object.entries(dictionary.toolLabels ?? {});
  const phrases = new Map(phraseEntries);
  const textPhrases = new Map([...phraseEntries, ...chromeEntries]);
  const chromeLinePhrases = new Map([...phraseEntries, ...chromeEntries, ...toolLabelEntries]);
  const frameLinePhrases = phrases;
  const patternEntries = dictionary.patterns ?? [];
  return {
    epoch: getUiEpoch(),
    phrases,
    textPhrases,
    chromeLinePhrases,
    frameLinePhrases,
    chromePattern: buildPhrasePattern(chromeLinePhrases),
    framePattern: buildPhrasePattern(frameLinePhrases),
    patterns: patternEntries.map(entry => new RegExp(entry.match)),
    replacements: patternEntries.map(entry => entry.replace),
    linePatterns: patternEntries.map(entry => buildLinePattern(entry.match)),
    prefixes: Object.entries(dictionary.prefixes ?? {}),
    linePrefixes: Object.entries(dictionary.prefixes ?? {}).map(([prefix, replacement]) => [
      new RegExp(escapeRegExp(prefix)),
      replacement,
    ]),
    toolLabels: new Map(toolLabelEntries),
    lineCache: new Map(),
  };
}

function current(): CompiledText {
  if (!compiled || compiled.epoch !== getUiEpoch()) {
    compiled = compile(getUiLocale());
  }
  return compiled;
}

/** Translate one complete UI string (a label, title, tooltip, hint). */
export function translateText(text: string): string {
  if (getUiLocale() === "en" || text.length === 0) return text;
  const c = current();
  const exact = c.textPhrases.get(text);
  if (exact !== undefined) return exact;
  for (let i = 0; i < c.patterns.length; i++) {
    if (c.patterns[i]!.test(text)) {
      return text.replace(c.patterns[i]!, c.replacements[i]!);
    }
  }
  for (const [prefix, replacement] of c.prefixes) {
    if (text.startsWith(prefix)) return replacement + text.slice(prefix.length);
  }
  return text;
}

export type LineTier = "chrome" | "frames";

/**
 * Translate phrases and patterns inside one rendered (possibly ANSI) line.
 *
 * `frames` is for components whose rows can include command output or file
 * content: only the dictionary's unambiguous phrases are replaced there.
 */
export function translateLine(line: string, tier: LineTier = "chrome"): string {
  if (getUiLocale() === "en" || line.length === 0) return line;
  const c = current();
  const cacheKey = `${tier}\u0000${line}`;
  const cached = c.lineCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // Patterns first: a phrase replacement could otherwise hide a dynamic rule.
  let out = line;
  for (let i = 0; i < c.linePatterns.length; i++) {
    out = out.replace(c.linePatterns[i]!, c.replacements[i]!);
  }
  for (const [prefixPattern, replacement] of c.linePrefixes) {
    out = out.replace(prefixPattern, replacement);
  }
  const pattern = tier === "chrome" ? c.chromePattern : c.framePattern;
  const lookup = tier === "chrome" ? c.chromeLinePhrases : c.frameLinePhrases;
  if (pattern) {
    pattern.lastIndex = 0;
    out = out.replace(pattern, match => lookup.get(match) ?? match);
  }

  if (c.lineCache.size >= LINE_CACHE_LIMIT) c.lineCache.clear();
  c.lineCache.set(cacheKey, out);
  return out;
}

export function translateLines(lines: readonly string[], tier: LineTier = "chrome"): readonly string[] {
  if (getUiLocale() === "en") return lines;
  let changed = false;
  const out = lines.map(line => {
    const next = translateLine(line, tier);
    if (next !== line) changed = true;
    return next;
  });
  return changed ? out : lines;
}

function translateSpans(value: unknown): { value: unknown; changed: boolean } {
  if (!Array.isArray(value)) return { value, changed: false };
  let changed = false;
  const out = value.map(span => {
    if (!isRecordObject(span) || typeof span.t !== "string") return span;
    const next = translateText(span.t);
    if (next === span.t) return span;
    changed = true;
    return { ...span, t: next };
  });
  return { value: changed ? out : value, changed };
}

function translateTextProp(value: unknown): { value: unknown; changed: boolean } {
  if (typeof value === "string") {
    const next = translateText(value);
    return { value: next, changed: next !== value };
  }
  return translateSpans(value);
}

function translateItems(value: unknown): { value: unknown; changed: boolean } {
  if (!Array.isArray(value)) return { value, changed: false };
  let changed = false;
  const out = value.map(item => {
    if (!isRecordObject(item)) return item;
    let nextItem: Record<string, unknown> | undefined;
    if (item.label !== undefined) {
      const result = translateTextProp(item.label);
      if (result.changed) nextItem = { ...item, label: result.value };
    }
    if (typeof item.title === "string") {
      const translated = translateText(item.title);
      if (translated !== item.title) nextItem = { ...(nextItem ?? item), title: translated };
    }
    if (nextItem) changed = true;
    return nextItem ?? item;
  });
  return { value: changed ? out : value, changed };
}

function translatePages(value: unknown): { value: unknown; changed: boolean } {
  if (!Array.isArray(value)) return { value, changed: false };
  let changed = false;
  const out = value.map(page => {
    if (!isRecordObject(page) || typeof page.label !== "string") return page;
    const translated = translateText(page.label);
    if (translated === page.label) return page;
    changed = true;
    return { ...page, label: translated };
  });
  return { value: changed ? out : value, changed };
}

const nodeCache = new WeakMap<object, { epoch: number; out: unknown }>();

/** Translate one native component description without mutating the host's node. */
export function translateNativeNode<T>(node: T): T {
  if (getUiLocale() === "en") return node;
  return walkNode(node) as T;
}

function walkNode(value: unknown): unknown {
  const node = asNativeNode(value);
  if (!node) return value;

  const cached = nodeCache.get(value as object);
  if (cached && cached.epoch === getUiEpoch()) return cached.out;

  const kind = node.k;
  const baseProps = node.p;
  let outProps: Record<string, unknown> | undefined;

  if (baseProps && SKIP_KINDS[kind] !== true) {
    const nextProps: Record<string, unknown> = { ...baseProps };
    let propsChanged = false;
    const assign = (key: string, result: { value: unknown; changed: boolean }): void => {
      if (!result.changed) return;
      nextProps[key] = result.value;
      propsChanged = true;
    };

    if (typeof baseProps.title === "string") {
      const translated = kind === "tool" ? current().toolLabels.get(baseProps.title) : undefined;
      assign("title", translated !== undefined ? { value: translated, changed: true } : translateTextProp(baseProps.title));
    }
    if (typeof baseProps.aria === "string") assign("aria", translateTextProp(baseProps.aria));
    if (baseProps.label !== undefined) assign("label", translateTextProp(baseProps.label));
    if (baseProps.head !== undefined) assign("head", translateTextProp(baseProps.head));
    if (baseProps.text !== undefined && kind === "text") assign("text", translateTextProp(baseProps.text));
    if (baseProps.spans !== undefined) assign("spans", translateSpans(baseProps.spans));
    if (baseProps.items !== undefined) assign("items", translateItems(baseProps.items));
    if (baseProps.pages !== undefined) assign("pages", translatePages(baseProps.pages));

    if (propsChanged) outProps = nextProps;
  }

  let outChildren: unknown[] | undefined;
  if (node.c) {
    let childrenChanged = false;
    const next = node.c.map(child => {
      const translated = walkNode(child);
      if (translated !== child) childrenChanged = true;
      return translated;
    });
    if (childrenChanged) outChildren = next;
  }

  const out =
    outProps || outChildren
      ? { ...(value as object), ...(outProps ? { p: outProps } : {}), ...(outChildren ? { c: outChildren } : {}) }
      : value;
  nodeCache.set(value as object, { epoch: getUiEpoch(), out });
  return out;
}
