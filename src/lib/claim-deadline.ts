// The claim deadline is counted from the day the notice is published in the Službeni glasnik.
// Counting rule: ZPP, Sl. glasnik RS 72/2011, art. 103 (applied in bankruptcy via art. 7 para. 2
// of the bankruptcy law and art. 22 of the bank bankruptcy law): the first day of the term is the day after
// publication; if the last day falls on a weekend or holiday, the term expires on the next
// working day. Holidays are not counted here: we give "the day by count", and shift only for weekends.
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
