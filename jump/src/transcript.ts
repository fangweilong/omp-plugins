import type { Theme } from "@oh-my-pi/pi-tui";
import { wrapTextWithAnsi } from "@oh-my-pi/pi-tui";

/** Structural view of a session entry, as exposed by `sessionManager.getBranch()`. */
export interface EntryLike {
	type?: string;
	id?: string;
	timestamp?: string;
	message?: {
		role?: string;
		content?: unknown;
	};
}

/** One user prompt that the navigator can jump to. */
export interface Turn {
	/** 0-based index among user turns. */
	index: number;
	entryId: string;
	/** Row in {@link Transcript.rows} where this prompt's first line lives. */
	row: number;
	/** Single-line prompt preview for the sticky band. */
	preview: string;
	/** `HH:MM` of the entry, empty when unparsable. */
	time: string;
}

export interface Transcript {
	rows: string[];
	turns: Turn[];
}

const BODY_GUTTER = 2;

function textBlocks(content: unknown): string[] {
	if (typeof content === "string") return content ? [content] : [];
	if (!Array.isArray(content)) return [];
	const out: string[] = [];
	for (const block of content) {
		if (!block || typeof block !== "object") continue;
		const typed = block as { type?: string; text?: unknown };
		if (typed.type === "text" && typeof typed.text === "string" && typed.text.length > 0) {
			out.push(typed.text);
		} else if (typed.type === "image") {
			out.push("[image]");
		}
	}
	return out;
}

function formatTime(timestamp: string | undefined): string {
	if (!timestamp) return "";
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return "";
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

function toolCallLine(block: { name?: unknown; arguments?: unknown }, width: number): string {
	const name = typeof block.name === "string" ? block.name : "tool";
	const raw = typeof block.arguments === "string" ? block.arguments : JSON.stringify(block.arguments ?? {});
	const args = (raw ?? "").replace(/\s+/g, " ").trim();
	const line = `  ⚙ ${name}${args && args !== "{}" ? ` ${args}` : ""}`;
	return line.length > width ? `${line.slice(0, Math.max(0, width - 1))}…` : line;
}

/**
 * Flatten the active branch into styled, wrapped rows plus one anchor per user
 * prompt. Tool results are dropped: their call line already marks the turn, and
 * a navigator reads better without result payloads.
 */
export function buildTranscript(entries: readonly EntryLike[], width: number, theme: Theme): Transcript {
	const rows: string[] = [];
	const turns: Turn[] = [];
	const innerWidth = Math.max(8, width - BODY_GUTTER);
	let lastBlank = true;

	const push = (line: string): void => {
		rows.push(line);
		lastBlank = line.trim().length === 0;
	};
	const gap = (): void => {
		if (!lastBlank) push("");
	};

	for (const entry of entries) {
		if (entry.type !== "message" || !entry.message) continue;
		const message = entry.message;

		if (message.role === "user") {
			const text = textBlocks(message.content).join("\n").trim() || "(empty message)";
			gap();
			const start = rows.length;
			const wrapped = wrapTextWithAnsi(text, innerWidth);
			wrapped.forEach((line, i) => {
				const gutter = theme.fg("accent", i === 0 ? "▌ " : "  ");
				push(gutter + theme.fg("userMessageText", line));
			});
			turns.push({
				index: turns.length,
				entryId: entry.id ?? `user-${turns.length}`,
				row: start,
				preview: text.replace(/\s+/g, " ").trim(),
				time: formatTime(entry.timestamp),
			});
			continue;
		}

		if (message.role !== "assistant" || !Array.isArray(message.content)) continue;
		let wroteText = false;
		for (const block of message.content) {
			if (!block || typeof block !== "object") continue;
			const typed = block as { type?: string; text?: unknown; name?: unknown; arguments?: unknown };
			if (typed.type === "thinking") continue;
			if (typed.type === "toolCall") {
				if (!lastBlank) push("");
				push(theme.fg("dim", toolCallLine(typed, innerWidth)));
				wroteText = true;
				continue;
			}
			if (typed.type !== "text" || typeof typed.text !== "string") continue;
			const text = typed.text.trim();
			if (text.length === 0) continue;
			if (!lastBlank) push("");
			for (const line of wrapTextWithAnsi(text, innerWidth)) {
				push(theme.fg("assistantMessageText", line));
			}
			wroteText = true;
		}
		if (wroteText) gap();
	}

	while (rows.length > 0 && rows[rows.length - 1]!.trim().length === 0) rows.pop();
	return { rows, turns };
}
