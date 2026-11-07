// Что показывает карточка отделения: тон блока статуса, шкала очереди, неделя.
// Можно ли отмечать очередь — canReport/reportsFrom в branch-hours.mjs.
// Чистые функции поверх branchStatus (branch-hours.mjs), чтобы проверять их тестами без часов и DOM.

import { hoursOn } from './branch-hours.mjs';

// Последний час до закрытия — предупреждаем янтарным, а не зелёным.
export const CLOSING_SOON_MIN = 60;
export const QUEUE_LEVELS = ['none', 'few', 'full', 'outside'];
export const MIXED = 'mixed';

/** Тон и иконка блока статуса: open — зелёный, soon — янтарный, closed — красный. */
export function statusTone(status) {
	if (status.state === 'open') return status.left > CLOSING_SOON_MIN ? { tone: 'open', icon: 'check' } : { tone: 'soon', icon: 'clock' };
	if (status.state === 'later') return { tone: 'soon', icon: 'sun' };
	return { tone: 'closed', icon: 'lock' };
}

/** Сколько делений шкалы из четырёх закрасить: none — 1 … outside — 4, без отметок — 0. */
export const queueLevel = (state) => QUEUE_LEVELS.indexOf(state) + 1;

/** «8–17» для плитки недели; минуты пишем, только когда они не нулевые. */
export function shortRange(range) {
	const t = (m) => (m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : String(m / 60));
	return `${t(range[0])}–${t(range[1])}`;
}

/** Неделя с понедельника: день (0 — вс), часы плитки или null в выходной, сегодня ли. */
export function weekTiles(wd, sat, today) {
	return [1, 2, 3, 4, 5, 6, 0].map((day) => {
		const h = hoursOn(day, wd, sat);
		return { day, hours: h ? shortRange(h) : null, today: day === today };
	});
}

/** «1 — мало людей, 1 — много · за 2 часа»: сколько голосов у каждого из спорящих состояний. */
export function splitText(split, labels, tail) {
	const parts = QUEUE_LEVELS.filter((state) => split?.[state]).map((state) => `${split[state]} — ${labels[state]}`);
	return `${parts.join(', ')} · ${tail}`;
}
