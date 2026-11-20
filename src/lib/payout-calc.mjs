// ALTA insurance payout calculation: repeats the table "ALTA: insurance payout calculation (up to 50 000 €)"
// formula for formula, so the numbers on the site and in the table match to the cent.
// Basis: Deposit Insurance Law art. 2 para. 7, art. 16, art. 17; AOD procedure, section V.

export const RATE = 117.5698; // average NBS rate on 03.11.2026, exchange list no. 210
export const LIMIT = 50000;

const round = (x, digits) => {
	const k = 10 ** digits;
	// EPSILON: 0.005 in binary is slightly less, and without the correction it would round down, unlike the table.
	return Math.round((x + Math.sign(x) * Number.EPSILON * Math.abs(x)) * k) / k;
};

/**
 * @param {{ eur?: number, rsd?: number, other?: number }} input — balances on 03.11.2026 with interest;
 *   other — other currencies already converted to euros; added to euros, as in the table.
 */
export function payout({ eur = 0, rsd = 0, other = 0 }, rate = RATE, limit = LIMIT) {
	const eurAll = eur + other;
	const rsdInEur = rsd / rate;
	const total = eurAll + rsdInEur;
	const insured = Math.min(total, limit);
	const eurShare = total === 0 ? 0 : eurAll / total;
	const rsdShare = total === 0 ? 0 : rsdInEur / total;
	const payEur = round(insured * eurShare, 2);
	const payRsd = round(insured * rsdShare * rate, 2);
	return {
		rate,
		rsdInEur,
		total,
		insured,
		overLimit: total > limit,
		eurShare,
		rsdShare,
		payEur,
		payRsd,
		claimEur: round(eurAll - payEur, 2),
		claimRsd: round(rsd - payRsd, 2),
		// The AOD procedure rounds shares to 6 digits; the difference is cents or a few dinars.
		aodEur: round(insured * round(eurShare, 6), 2),
		aodRsd: round(insured * round(rsdShare, 6) * rate, 2),
	};
}

const AMOUNT = /^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Parses an amount the way it is written in Serbia, Russia and in English: "60.000", "60,000", "50.000,50", "60 000".
 * A dot or comma before a group of exactly three digits is a thousands separator, before the last 1-2 digits a decimal one.
 * @param {string} s
 * @returns {number | null} null if the string does not look like an amount (including empty): do not count it as zero.
 */
export function parseAmount(s) {
	const m = AMOUNT.exec(String(s).replace(/[\s  ']/g, ''));
	if (!m) return null;
	return Number(`${m[1].replace(/[.,]/g, '')}.${m[2] ?? '0'}`);
}
