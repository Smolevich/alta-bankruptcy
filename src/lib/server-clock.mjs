// Часы карты отделений: время берём у сервера, а не у телефона — у телефона часы могут врать.
// Часовой пояс и переход на зимнее время решает Intl (Europe/Belgrade), от настроек устройства не зависит.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BELGRADE = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Belgrade', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Поправка к часам устройства в мс. serverIso — `now` из GET /api/queue, ageSec — заголовок Age кэша. */
export function clockOffset(serverIso, ageSec, deviceMs) {
	const server = Date.parse(serverIso ?? '');
	if (!Number.isFinite(server)) return 0;
	return server + (Number(ageSec) || 0) * 1000 - deviceMs;
}

/** День недели (0 — воскресенье) и минуты от полуночи по Белграду. */
export function belgradeParts(ms) {
	const parts = BELGRADE.formatToParts(new Date(ms));
	const get = (t) => parts.find((p) => p.type === t)?.value ?? '';
	return { day: DAYS.indexOf(get('weekday')), min: Number(get('hour')) * 60 + Number(get('minute')) };
}
