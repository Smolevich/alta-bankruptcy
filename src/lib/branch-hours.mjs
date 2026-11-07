// Часы отделения: открыто ли сейчас и когда откроется. Чистые функции, время уже по Белграду
// (day: 0 — вс … 6 — сб, min — минуты от полуночи), чтобы проверять их тестами без часов.

// «08:00-15:00» и «8.00h - 15.00h» — оба вида записи из PDF AOD.
export function parseRange(text) {
	const m = (text ?? '').match(/(\d{1,2})[.:](\d{2})h?\s*-\s*(\d{1,2})[.:](\d{2})/);
	return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
}

export const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

/** Часы дня недели: вс закрыто, сб — субботние, остальные — будние. */
export function hoursOn(day, wd, sat) {
	if (day === 0) return null;
	return day === 6 ? sat : wd;
}

/**
 * Статус «можно ли пойти сейчас».
 * open: { state: 'open', closesAt, left }
 * до открытия сегодня: { state: 'later', opensAt }
 * день закончился или выходной: { state: 'closed', closedAt (null в выходной), nextDay, opensAt, tomorrow }
 */
export function branchStatus(wd, sat, day, min) {
	const today = hoursOn(day, wd, sat);
	if (today && min >= today[0] && min < today[1]) return { state: 'open', closesAt: today[1], left: today[1] - min };
	if (today && min < today[0]) return { state: 'later', opensAt: today[0] };
	for (let i = 1; i <= 7; i++) {
		const d = (day + i) % 7;
		const h = hoursOn(d, wd, sat);
		if (h) return { state: 'closed', closedAt: today ? today[1] : null, nextDay: d, opensAt: h[0], tomorrow: i === 1 };
	}
	return { state: 'closed', closedAt: today ? today[1] : null, nextDay: null, opensAt: null, tomorrow: false };
}

// Отметки очереди принимаем, пока открыто и за час до открытия (люди собираются у двери).
export const PRE_OPEN_MIN = 60;

/** Можно ли сейчас отметить очередь: открыто или до открытия осталось не больше часа. */
export function canReport(status, min) {
	if (status.state === 'open') return true;
	return status.state === 'later' && status.opensAt - min <= PRE_OPEN_MIN;
}

/** Во сколько откроются отметки: за час до открытия. */
export const reportsFrom = (opensAt) => Math.max(opensAt - PRE_OPEN_MIN, 0);
