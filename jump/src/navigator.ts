import type { Component, SgrMouseEvent, Theme, TUI } from "@oh-my-pi/pi-tui";
import { matchesKey, parseSgrMouse, truncateToWidth, visibleWidth } from "@oh-my-pi/pi-tui";
import { buildTranscript, type EntryLike, type Transcript } from "./transcript.js";

const BAND_MAX_ROWS = 8;
const BAND_MIN_ROWS = 3;
const WHEEL_STEP = 3;

export interface NavigatorOptions {
	entries: readonly EntryLike[];
	theme: Theme;
	tui: TUI;
	/** Close the overlay and resolve the owning `ui.custom()` promise. */
	done: () => void;
}

/** Layout of the last rendered frame, used to hit-test pointer events. */
interface FrameLayout {
	bandStart: number;
	bandRows: number;
	bodyRows: number;
	scroll: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Fullscreen session navigator: a sticky band of user prompts over a transcript
 * replica. Selecting a prompt scrolls the replica so that prompt starts the
 * viewport; clicking a band row, a transcript row, or the wheel does the same.
 */
export class NavigatorComponent implements Component {
	focused = false;

	readonly #entries: readonly EntryLike[];
	readonly #theme: Theme;
	readonly #tui: TUI;
	readonly #done: () => void;

	#transcript: Transcript | undefined;
	#transcriptWidth = -1;
	#selected = 0;
	#scroll = 0;
	#initialized = false;
	#layout: FrameLayout | undefined;

	constructor(options: NavigatorOptions) {
		this.#entries = options.entries;
		this.#theme = options.theme;
		this.#tui = options.tui;
		this.#done = options.done;
	}

	invalidate(): void {
		this.#transcript = undefined;
		this.#transcriptWidth = -1;
		this.#layout = undefined;
	}

	render(width: number): readonly string[] {
		const theme = this.#theme;
		const innerWidth = Math.max(1, width);
		const terminalRows = this.#tui.terminal?.rows ?? 24;
		const height = Math.max(5, terminalRows);

		if (!this.#transcript || this.#transcriptWidth !== width) {
			this.#transcript = buildTranscript(this.#entries, innerWidth, theme);
			this.#transcriptWidth = width;
			// First frame opens on the newest prompt; later rewraps keep the
			// selection but re-anchor it to the rebuilt rows.
			const anchor = this.#initialized
				? this.#transcript.turns[this.#selected]
				: this.#transcript.turns.at(-1);
			this.#initialized = true;
			if (anchor) {
				this.#selected = anchor.index;
				this.#scroll = anchor.row;
			}
		}
		const { rows, turns } = this.#transcript;

		const bandRows =
			turns.length === 0 || height < 8
				? 0
				: Math.min(turns.length, BAND_MAX_ROWS, Math.max(BAND_MIN_ROWS, Math.floor(height * 0.35)));
		const bodyRows = Math.max(1, height - bandRows - 3);
		const maxScroll = Math.max(0, rows.length - bodyRows);
		const scroll = clamp(this.#scroll, 0, maxScroll);
		const selected = clamp(this.#selected, 0, Math.max(0, turns.length - 1));
		const bandStart = clamp(selected - Math.floor(bandRows / 2), 0, Math.max(0, turns.length - bandRows));
		this.#scroll = scroll;
		this.#selected = selected;
		this.#layout = { bandStart, bandRows, bodyRows, scroll };

		const out: string[] = [];

		// Header: title + position counter, close hint on the right.
		const title = `${theme.bold(theme.fg("accent", " 消息导航"))}`;
		const counter = theme.fg("muted", `  ${turns.length === 0 ? 0 : selected + 1}/${turns.length}`);
		const closeHint = theme.fg("dim", "esc ");
		const headerPad = Math.max(1, innerWidth - visibleWidth(title) - visibleWidth(counter) - visibleWidth(closeHint));
		out.push(title + counter + " ".repeat(headerPad) + closeHint);

		// Sticky band of user prompts.
		for (let row = 0; row < bandRows; row++) {
			const turn = turns[bandStart + row];
			if (!turn) {
				out.push(" ".repeat(innerWidth));
				continue;
			}
			const active = bandStart + row === selected;
			const indexWidth = String(turns.length).length;
			const label = String(turn.index + 1).padStart(indexWidth);
			const suffix = turn.time ? ` ${turn.time}` : "";
			const previewWidth = Math.max(4, innerWidth - indexWidth - 5 - visibleWidth(suffix));
			const marker = theme.fg(active ? "accent" : "dim", active ? "▸" : " ");
			const body = theme.fg(active ? "text" : "muted", truncateToWidth(turn.preview, previewWidth));
			const left = ` ${theme.fg(active ? "accent" : "dim", label)} ${marker} ${body}`;
			const pad = Math.max(0, innerWidth - visibleWidth(left) - visibleWidth(suffix));
			let line = left + " ".repeat(pad) + theme.fg("dim", suffix);
			if (active) {
				const extra = Math.max(0, innerWidth - visibleWidth(line));
				line = theme.bg("selectedBg", line + " ".repeat(extra));
			}
			out.push(line);
		}

		out.push(theme.fg("borderMuted", "─".repeat(innerWidth)));

		// Transcript replica, scrolled so the selected prompt heads the viewport.
		for (let row = 0; row < bodyRows; row++) {
			const line = rows[scroll + row];
			out.push(line === undefined ? "" : truncateToWidth(line, innerWidth));
		}

		out.push(theme.fg("dim", truncateToWidth(" ↑↓ 选择 · PgUp/PgDn 滚动 · 点击跳转 · esc 关闭", innerWidth)));
		while (out.length < height) out.push("");
		return out.slice(0, height);
	}

	handleInput(data: string): void {
		if (data.startsWith("\x1b[<")) {
			// A click arrives as press+release in one chunk, so decode each report
			// in turn instead of treating the chunk as a single sequence.
			let rest = data;
			while (rest.startsWith("\x1b[<")) {
				const match = /^\x1b\[<(\d+);(\d+);(\d+)([Mm])/.exec(rest);
				if (!match) break;
				const event = parseSgrMouse(match[0]);
				if (event) this.#handleMouse(event);
				rest = rest.slice(match[0].length);
			}
			return;
		}
		if (matchesKey(data, "escape") || matchesKey(data, "ctrl+c") || data === "q") {
			this.#done();
			return;
		}

		const transcript = this.#transcript;
		const turns = transcript?.turns ?? [];
		const rowCount = transcript?.rows.length ?? 0;
		const layout = this.#layout;
		if (turns.length === 0) {
			if (matchesKey(data, "up") || matchesKey(data, "down")) this.#scroll = 0;
			return;
		}
		if (matchesKey(data, "up") || data === "k") this.#select(this.#selected - 1);
		else if (matchesKey(data, "down") || data === "j") this.#select(this.#selected + 1);
		else if (matchesKey(data, "pageUp") || data === "K") {
			this.#scrollBy(-(layout?.bodyRows ?? 10), rowCount);
		} else if (matchesKey(data, "pageDown") || data === "J") {
			this.#scrollBy(layout?.bodyRows ?? 10, rowCount);
		} else if (matchesKey(data, "home") || data === "g") this.#select(0);
		else if (matchesKey(data, "end") || data === "G") this.#select(turns.length - 1);
	}

	#handleMouse(event: SgrMouseEvent): void {
		const turns = this.#transcript?.turns ?? [];
		const rows = this.#transcript?.rows ?? [];
		const layout = this.#layout;
		if (!layout) return;
		if (event.wheel !== null) {
			this.#scrollBy(event.wheel * WHEEL_STEP, rows.length);
			return;
		}
		if (!event.leftClick) return;
		const { bandStart, bandRows, bodyRows, scroll } = layout;
		if (event.row >= 1 && event.row < 1 + bandRows) {
			const index = bandStart + event.row - 1;
			if (index < turns.length) this.#select(index);
			return;
		}
		const bodyTop = 1 + bandRows + 1;
		if (event.row >= bodyTop && event.row < bodyTop + bodyRows) {
			const absolute = scroll + event.row - bodyTop;
			let index = 0;
			for (const turn of turns) if (turn.row <= absolute) index = turn.index;
			this.#select(index);
		}
	}

	#select(index: number): void {
		const turns = this.#transcript?.turns ?? [];
		if (turns.length === 0) return;
		const next = clamp(index, 0, turns.length - 1);
		this.#selected = next;
		this.#scroll = turns[next]!.row;
		this.#tui.requestRender();
	}

	#scrollBy(delta: number, rowCount: number): void {
		const bodyRows = this.#layout?.bodyRows ?? 10;
		const next = clamp(this.#scroll + delta, 0, Math.max(0, rowCount - bodyRows));
		if (next === this.#scroll) return;
		this.#scroll = next;
		this.#tui.requestRender();
	}
}
