// Branch load chart by hour 8–20. Drawn in the browser from the list row's data-wd/data-sat:
// 42 prebuilt SVGs in HTML (and their copy in the map points JSON) weighed more than half of the /vyplata/ page.

const STEP = 10;
const HOURS = [8, 12, 16, 20];

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** '0,12,,40' → [0, 12, 0, 40]; empty gives []. A skipped hour (closed) is drawn as a zero bar. */
export const histValues = (raw) => (raw ? raw.split(',').map((v) => Number(v) || 0) : []);

/** One chart row: a label and an SVG, a bar is a percent of the branch's own peak. */
export function histRow(label, values) {
	const width = 13 * STEP;
	const bars = values
		.map((p, i) => `<rect x="${i * STEP + 1}" y="${30 - p * 0.28}" width="8" height="${p * 0.28}" class="bar"/>`)
		.join('');
	const ticks = HOURS.map((h) => `<text x="${(h - 8) * STEP + 5}" y="40" text-anchor="middle" class="tick">${h}</text>`).join('');
	return `<div class="hist-lbl">${esc(label)}</div><svg viewBox="0 0 ${width} 43" class="hist-svg" role="img" aria-label="${esc(label)}: ${values.join(', ')}%"><line x1="0" y1="30.5" x2="${width}" y2="30.5" class="axis"/>${bars}${ticks}</svg>`;
}

/** The chart block: weekdays and, if present, Saturday; with no weekday data, an empty string. */
export function histHtml(wd, sat, text) {
	if (!wd.length) return '';
	return `<div class="hist" role="group" aria-label="${esc(text.chartLabel)}">${histRow(text.chartWd, wd)}${sat.length ? histRow(text.chartSat, sat) : ''}</div>`;
}
