// Расчёт страховой выплаты ALTA — повторяет таблицу «ALTA: расчёт страховой выплаты (до 50 000 €)»
// формула в формулу, чтобы цифры на сайте и в таблице совпадали до цента.
// Основа: Закон о страховании вкладов ст. 2 п. 7, ст. 16, ст. 17; процедура AOD, разд. V.

export const RATE = 117.5698; // средний курс НБС на 03.11.2026, курсовой лист № 210
export const LIMIT = 50000;

const round = (x, digits) => {
	const k = 10 ** digits;
	// EPSILON: 0.005 в двоичной записи чуть меньше, и без поправки округлялось бы вниз, не как в таблице.
	return Math.round((x + Math.sign(x) * Number.EPSILON * Math.abs(x)) * k) / k;
};

/**
 * @param {{ eur?: number, rsd?: number, other?: number }} input — остатки на 03.11.2026 с процентами;
 *   other — прочие валюты, уже переведённые в евро; прибавляются к евро, как в таблице.
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
		// Процедура AOD округляет доли до 6 знаков; расхождение — центы или несколько динаров.
		aodEur: round(insured * round(eurShare, 6), 2),
		aodRsd: round(insured * round(rsdShare, 6) * rate, 2),
	};
}

const AMOUNT = /^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/;

/**
 * Разбирает сумму так, как её пишут в Сербии, России и по-английски: «60.000», «60,000», «50.000,50», «60 000».
 * Точка или запятая перед группой ровно из трёх цифр — разделитель тысяч, перед 1–2 последними цифрами — десятичная.
 * @param {string} s
 * @returns {number | null} null — строка не похожа на сумму (в том числе пустая): считать её нулём нельзя.
 */
export function parseAmount(s) {
	const m = AMOUNT.exec(String(s).replace(/[\s  ']/g, ''));
	if (!m) return null;
	return Number(`${m[1].replace(/[.,]/g, '')}.${m[2] ?? '0'}`);
}
