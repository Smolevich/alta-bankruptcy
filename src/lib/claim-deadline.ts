// Срок подачи требования считается от дня публикации объявления в «Службени гласник».
// Правило счёта: ZPP, Sl. glasnik RS 72/2011, ст. 103 (в банкротстве применяется по ст. 7 ч. 2
// закона о банкротстве и ст. 22 закона о банкротстве банков): первый день срока — день после
// публикации; если последний день выпадает на выходной или праздник, срок истекает в следующий
// рабочий день. Праздники здесь не считаем: даём «день по счёту», а перенос — только с выходных.
export const ORDINARY_DAYS = 90;
export const LATE_DAYS = 120;

const DAY_MS = 86_400_000;

export type Deadline = { nominal: Date; weekendShift: Date | null };

function addDays(d: Date, n: number): Date {
	return new Date(d.getTime() + n * DAY_MS);
}

export function lastDay(publication: Date, days: number): Deadline {
	const nominal = addDays(publication, days);
	const dow = nominal.getUTCDay();
	const shift = dow === 6 ? 2 : dow === 0 ? 1 : 0;
	return { nominal, weekendShift: shift ? addDays(nominal, shift) : null };
}

export function parsePublicationDate(value: string | null | undefined): Date | null {
	if (!value) return null;
	const d = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(d.getTime()) ? null : d;
}

export function claimWindows(publication: Date) {
	return {
		ordinary: lastDay(publication, ORDINARY_DAYS),
		late: lastDay(publication, LATE_DAYS),
		lateFrom: addDays(publication, ORDINARY_DAYS + 1),
	};
}
