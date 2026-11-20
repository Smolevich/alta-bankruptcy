// What the branch card shows: the status block tone, the queue scale, the week.
// Whether the queue can be marked: canReport/reportsFrom in branch-hours.mjs.
// Pure functions over branchStatus (branch-hours.mjs), so tests can check them without clocks and DOM.

import { hoursOn } from './branch-hours.mjs';

// The last hour before closing gets an amber warning, not green.
export const CLOSING_SOON_MIN = 60;
export const QUEUE_LEVELS = ['none', 'few', 'full', 'outside'];
export const MIXED = 'mixed';

/** Tone and icon of the status block: open is green, soon is amber, closed is red. */
export function statusTone(status) {
	if (status.state === 'open') return status.left > CLOSING_SOON_MIN ? { tone: 'open', icon: 'check' } : { tone: 'soon', icon: 'clock' };
	if (status.state === 'later') return { tone: 'soon', icon: 'sun' };
	return { tone: 'closed', icon: 'lock' };
}

/** How many of four scale segments to fill: none is 1 ... outside is 4, no marks is 0. */
export const queueLevel = (state) => QUEUE_LEVELS.indexOf(state) + 1;

/** "8–17" for a week tile; minutes are written only when non-zero. */
export function shortRange(range) {
	const t = (m) => (m % 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : String(m / 60));
	return `${t(range[0])}–${t(range[1])}`;
}

/** Week from Monday: day (0 is Sun), tile hours or null on a day off, whether it is today. */
export function weekTiles(wd, sat, today) {
	return [1, 2, 3, 4, 5, 6, 0].map((day) => {
		const h = hoursOn(day, wd, sat);
		return { day, hours: h ? shortRange(h) : null, today: day === today };
	});
}

/** "1 — few people, 1 — many · over 2 hours": how many votes each of the contested states has. */
export function splitText(split, labels, tail) {
	const parts = QUEUE_LEVELS.filter((state) => split?.[state]).map((state) => `${split[state]} — ${labels[state]}`);
	return `${parts.join(', ')} · ${tail}`;
}
