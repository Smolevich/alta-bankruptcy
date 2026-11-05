// Активы ALTA banka на 30.06.2026 из обязательного раскрытия за I полугодие 2026 (PDF, с. 12),
// в тысячах динаров, как в отчёте. Одни числа на три языка: перевод меняет только подписи.
import type { Lang } from '../i18n';

type Text = Record<Lang, string>;

/** Средний курс Нацбанка на дату отчёта (30.06.2026), динаров за 1 €. */
export const EUR_RATE = 117.3697;

export const ASSETS_PDF = '/docs/alta-2026-h1-objavljivanje.pdf#page=12';

export type AssetRow = { label: Text; note: Text; thousandRsd: number };

export const ASSET_ROWS: AssetRow[] = [
	{
		label: { ru: 'Кредиты клиентам', en: 'Loans to customers', sr: 'Krediti komitentima' },
		note: {
			ru: 'Долги компаний и людей перед банком. На 31.12.2025 было 75 801 млн.',
			en: 'What companies and people owe the bank. RSD 75,801 m at 31.12.2025.',
			sr: 'Dugovi firmi i građana prema banci. Na dan 31.12.2025. bilo je 75.801 mil.',
		},
		thousandRsd: 105_857_124,
	},
	{
		label: { ru: 'Наличные и деньги в Нацбанке', en: 'Cash and funds at the central bank', sr: 'Gotovina i sredstva kod NBS' },
		note: {
			ru: 'Касса, счёт в Нацбанке, обязательный резерв.',
			en: 'Cash on hand, the account at the central bank, the mandatory reserve.',
			sr: 'Blagajna, račun kod NBS, obavezna rezerva.',
		},
		thousandRsd: 83_466_748,
	},
	{
		label: { ru: 'Деньги в других банках', en: 'Placements with other banks', sr: 'Plasmani bankama' },
		note: {
			ru: 'Кредиты и счета в банках и финансовых организациях.',
			en: 'Loans to and accounts with banks and financial institutions.',
			sr: 'Krediti i potraživanja od banaka i drugih finansijskih organizacija.',
		},
		thousandRsd: 15_449_658,
	},
	{
		label: { ru: 'Здания, земля, оборудование', en: 'Buildings, land, equipment', sr: 'Nekretnine, postrojenja i oprema' },
		note: {
			ru: 'Включая аренду помещений. За полгода +1 730 млн, причина в отчёте не указана.',
			en: 'Including leased premises. Up RSD 1,730 m in six months; the report gives no reason.',
			sr: 'Uključujući zakup prostora. Za pola godine +1.730 mil, razlog u izveštaju nije naveden.',
		},
		thousandRsd: 4_534_117,
	},
	{
		label: { ru: 'Дочерние компании', en: 'Subsidiaries', sr: 'Zavisna društva' },
		note: {
			ru: 'ALTA banka Bitola (Северная Македония) и ALTA Leasing.',
			en: 'ALTA banka Bitola (North Macedonia) and ALTA Leasing.',
			sr: 'ALTA banka Bitola (Severna Makedonija) i ALTA Leasing.',
		},
		thousandRsd: 2_934_932,
	},
	{
		label: { ru: 'Ценные бумаги', en: 'Securities', sr: 'Hartije od vrednosti' },
		note: {
			ru: 'На 31.12.2025 — в основном облигации Сербии.',
			en: 'At 31.12.2025 mostly Serbian government bonds.',
			sr: 'Na dan 31.12.2025. uglavnom obveznice Republike Srbije.',
		},
		thousandRsd: 977_032,
	},
	{
		label: { ru: 'Недвижимость, сданная в аренду', en: 'Investment property', sr: 'Investicione nekretnine' },
		note: {
			ru: 'На 31.12.2025 — часть офисного здания (247 м²) и квартира.',
			en: 'At 31.12.2025 part of an office building (247 m²) and a flat.',
			sr: 'Na dan 31.12.2025. deo poslovne zgrade (247 m²) i stambena nepokretnost.',
		},
		thousandRsd: 102_565,
	},
	{
		label: { ru: 'Прочее', en: 'Other', sr: 'Ostalo' },
		note: {
			ru: 'Программы и лицензии 443 млн, прочие активы 979 млн, налоги 149 млн, деривативы 38 млн.',
			en: 'Software and licences 443 m, other assets 979 m, taxes 149 m, derivatives 38 m.',
			sr: 'Nematerijalna ulaganja 443 mil, ostala sredstva 979 mil, porez 149 mil, derivati 38 mil.',
		},
		thousandRsd: 1_609_026,
	},
];

export const ASSETS_TOTAL = 214_931_202;
