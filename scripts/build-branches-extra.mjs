// Собирает src/data/postanska-branches-extra.json: координаты, ссылка на Google Карты, размер и загрузка по отделениям.
// Вход — выгрузки из agents/work/alta-3110 (фото Google Карт и Popular Times от 06.11.2026); пути передаются аргументами.
// Запуск: node scripts/build-branches-extra.mjs <branches-photos.json> <branches-apify.json>
import { readFileSync, writeFileSync } from 'node:fs';

const [photosPath, apifyPath] = process.argv.slice(2);
if (!photosPath || !apifyPath) throw new Error('usage: build-branches-extra.mjs <photos.json> <apify.json>');

const SIZE = { большое: 'large', среднее: 'medium', маленькое: 'small' };
const SOURCE_DATE = '2026-11-06';
const THRESHOLD = 0.8;

// Загрузка по часам: среднее по дням, часы >= 80% от максимума отделения, самый длинный непрерывный отрезок.
function peak(histogram, days) {
	const byHour = new Map();
	for (const day of days) {
		for (const { hour, occupancyPercent } of histogram?.[day] ?? []) {
			byHour.set(hour, [...(byHour.get(hour) ?? []), occupancyPercent]);
		}
	}
	const avg = [...byHour].map(([h, v]) => [h, v.reduce((a, b) => a + b, 0) / v.length]).sort((a, b) => a[0] - b[0]);
	const max = Math.max(0, ...avg.map(([, v]) => v));
	if (max <= 0) return null;
	let best = null;
	let cur = null;
	for (const [h, v] of avg) {
		if (v >= max * THRESHOLD) {
			cur = cur && cur[1] === h - 1 ? [cur[0], h] : [h, h];
			if (!best || cur[1] - cur[0] > best[1] - best[0]) best = cur;
		} else cur = null;
	}
	return best ? `${best[0]}–${best[1] + 1}` : null;
}

// Часы 8–20 для столбиков: среднее по дням, округлено до целого процента; null — Google не дал данных.
function hist(histogram, days) {
	const rows = days.map((d) => new Map((histogram?.[d] ?? []).map((x) => [x.hour, x.occupancyPercent])));
	const out = [];
	for (let h = 8; h <= 20; h++) {
		const v = rows.map((r) => r.get(h)).filter((x) => x !== undefined);
		out.push(v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null);
	}
	return out.some((x) => x) ? out : null;
}

function mapsUrl(p, a) {
	if (a?.placeId) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.maps_name ?? 'Banka Poštanska štedionica')}&query_place_id=${a.placeId}`;
	if (p.maps_url && p.maps_url.length > 40) return p.maps_url;
	return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

const photos = JSON.parse(readFileSync(photosPath, 'utf8'));
const apify = JSON.parse(readFileSync(apifyPath, 'utf8'));
const out = {};
for (const p of photos) {
	const a = apify[p.id];
	// В списке AOD у двух отделений шифра с пробелом («753 930»), в выгрузках — через дефис.
	out[p.id.replace('-', ' ')] = {
		lat: p.lat,
		lng: p.lng,
		maps_url: mapsUrl(p, a),
		size: SIZE[p.size_guess] ?? null,
		peak: peak(a?.popularTimesHistogram, ['Mo', 'Tu', 'We', 'Th', 'Fr']),
		peak_saturday: peak(a?.popularTimesHistogram, ['Sa']),
		hist: hist(a?.popularTimesHistogram, ['Mo', 'Tu', 'We', 'Th', 'Fr']) && { weekday: hist(a.popularTimesHistogram, ['Mo', 'Tu', 'We', 'Th', 'Fr']), sat: hist(a.popularTimesHistogram, ['Sa']) },
		sv_date: p.streetview_date && p.streetview_date !== 'None' ? p.streetview_date : null,
		source_date: SOURCE_DATE,
	};
}
writeFileSync(new URL('../src/data/postanska-branches-extra.json', import.meta.url), JSON.stringify(out, null, '\t') + '\n');
console.log(`${Object.keys(out).length} branches`);
