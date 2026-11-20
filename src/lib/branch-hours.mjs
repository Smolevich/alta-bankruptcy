// Branch hours: is it open now and when it opens. Pure functions, the time is already Belgrade time
// (day: 0 is Sun ... 6 is Sat, min is minutes from midnight), so tests can check them without clocks.

// "08:00-15:00" and "8.00h - 15.00h" are both notations from the AOD PDF.
export function parseRange(text) {
	const m = (text ?? '').match(/(\d{1,2})[.:](\d{2})h?\s*-\s*(\d{1,2})[.:](\d{2})/);
	return m ? [Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])] : null;
}

export const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;

/** Hours of a weekday: Sunday closed, Saturday its own, the rest weekdays. */
export function hoursOn(day, wd, sat) {
	if (day === 0) return null;
	return day === 6 ? sat : wd;
}

/**
 * Status "can I go now".
 * open: { state: 'open', closesAt, left }
 * before opening today: { state: 'later', opensAt }
 * the day has ended or a day off: { state: 'closed', closedAt (null on a day off), nextDay, opensAt, tomorrow }
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

// Mark acceptance window: an hour before opening (people gather at the door) and an hour after closing (a branch
// does not close exactly on time, and hours can be extended). Mirrors PRE_OPEN/POST_CLOSE in
// backend/src/alta_feedback/queues.py, equality is checked by scripts/branch-hours.test.mjs.
export const PRE_OPEN_MIN = 60;
export const POST_CLOSE_MIN = 60;

/** Whether the queue can be marked now: open, an hour before opening or an hour after closing. */
export function canReport(status, min) {
	if (status.state === 'open') return true;
	if (status.state === 'later') return status.opensAt - min <= PRE_OPEN_MIN;
	return status.state === 'closed' && status.closedAt !== null && min - status.closedAt < POST_CLOSE_MIN;
}

/** When marks open: an hour before opening. */
export const reportsFrom = (opensAt) => Math.max(opensAt - PRE_OPEN_MIN, 0);
