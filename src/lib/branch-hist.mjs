// График загрузки отделения по часам 8–20. Рисуется в браузере из data-wd/data-sat строки списка:
// 42 готовых SVG в HTML (и их копия в JSON точек карты) весили больше половины страницы /vyplata/.

const STEP = 10;
const HOURS = [8, 12, 16, 20];

const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** '0,12,,40' → [0, 12, 0, 40]; пусто — []. Пропуск часа (закрыто) рисуется нулевым столбиком. */
export const histValues = (raw) => (raw ? raw.split(',').map((v) => Number(v) || 0) : []);

/** Одна строка графика: подпись и SVG, столбик — процент от пика самого отделения. */
export function histRow(label, values) {
	const width = 13 * STEP;
	const bars = values
		.map((p, i) => `<rect x="${i * STEP + 1}" y="${30 - p * 0.28}" width="8" height="${p * 0.28}" class="bar"/>`)
		.join('');
	const ticks = HOURS.map((h) => `<text x="${(h - 8) * STEP + 5}" y="40" text-anchor="middle" class="tick">${h}</text>`).join('');
	return `<div class="hist-lbl">${esc(label)}</div><svg viewBox="0 0 ${width} 43" class="hist-svg" role="img" aria-label="${esc(label)}: ${values.join(', ')}%"><line x1="0" y1="30.5" x2="${width}" y2="30.5" class="axis"/>${bars}${ticks}</svg>`;
}

/** Блок графика: будни и, если есть, суббота; без данных о буднях — пустая строка. */
export function histHtml(wd, sat, text) {
	if (!wd.length) return '';
	return `<div class="hist" role="group" aria-label="${esc(text.chartLabel)}">${histRow(text.chartWd, wd)}${sat.length ? histRow(text.chartSat, sat) : ''}</div>`;
}
