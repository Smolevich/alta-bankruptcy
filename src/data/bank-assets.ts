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
			ru: 'На 31.12.2025 в эту строку входили и взятые в лизинг помещения и машины (759 млн). За полгода +1 730 млн, что добавилось — не сказано.',
			en: 'At 31.12.2025 this line also included leased premises and cars (759 m). Up 1,730 m in six months; what was added is not stated.',
			sr: 'Na dan 31.12.2025. ova pozicija je obuhvatala i sredstva uzeta u lizing (759 mil). Za pola godine +1.730 mil; šta je dodato, nije navedeno.',
		},
		thousandRsd: 4_534_117,
	},
	{
		label: { ru: 'Дочерние компании', en: 'Subsidiaries', sr: 'Zavisna društva' },
		note: {
			ru: 'На 31.12.2025: ALTA banka a.d. Bitola, ALTA Leasing и фонд «Dečje srce».',
			en: 'At 31.12.2025: ALTA banka a.d. Bitola, ALTA Leasing and the «Dečje srce» foundation.',
			sr: 'Na dan 31.12.2025: ALTA banka a.d. Bitola, ALTA Leasing i Fondacija Dečje srce.',
		},
		thousandRsd: 2_934_932,
	},
	{
		label: { ru: 'Ценные бумаги', en: 'Securities', sr: 'Hartije od vrednosti' },
		note: {
			ru: 'На 31.12.2025 из 1 087 млн — 923 млн облигации и векселя Сербии.',
			en: 'At 31.12.2025, 923 m of 1,087 m were Serbian bonds and treasury bills.',
			sr: 'Na dan 31.12.2025. od 1.087 mil, 923 mil su obveznice i državni zapisi RS.',
		},
		thousandRsd: 977_032,
	},
	{
		label: { ru: 'Недвижимость, сданная в аренду', en: 'Investment property', sr: 'Investicione nekretnine' },
		note: {
			ru: 'На 31.12.2025 — часть офисного здания (247,18 м²) и жилая недвижимость.',
			en: 'At 31.12.2025 part of an office building (247.18 m²) and residential property.',
			sr: 'Na dan 31.12.2025. deo poslovne zgrade (247,18 m²) i stambena nepokretnost.',
		},
		thousandRsd: 102_565,
	},
	{
		label: { ru: 'Прочее', en: 'Other', sr: 'Ostalo' },
		note: {
			ru: 'Нематериальные активы 443 млн, прочие активы 979 млн, текущие налоговые активы 149 млн, деривативы 38 млн.',
			en: 'Intangible assets 443 m, other assets 979 m, current tax assets 149 m, derivatives 38 m.',
			sr: 'Nematerijalna ulaganja 443 mil, ostala sredstva 979 mil, tekuća poreska sredstva 149 mil, derivati 38 mil.',
		},
		thousandRsd: 1_609_026,
	},
];

export const ASSETS_TOTAL = 214_931_202;
