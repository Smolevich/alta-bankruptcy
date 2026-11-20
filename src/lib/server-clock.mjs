// Branch map clock: time comes from the server, not the phone, since a phone clock can lie.
// The time zone and the switch to winter time are handled by Intl (Europe/Belgrade), independent of device settings.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BELGRADE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Belgrade', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Correction to the device clock in ms. serverIso is `now` from GET /api/queue, ageSec is the cache Age header. */
export function clockOffset(serverIso, ageSec, deviceMs) {
	const server = Date.parse(serverIso ?? '');
	if (!Number.isFinite(server)) return 0;
	return server + (Number(ageSec) || 0) * 1000 - deviceMs;
}

/** Weekday (0 is Sunday) and minutes from midnight in Belgrade. */
export function belgradeParts(ms) {
	const parts = BELGRADE.formatToParts(new Date(ms));
	const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
	return { day: DAYS.indexOf(get('weekday')), min: Number(get('hour')) * 60 + Number(get('minute')) };
}
