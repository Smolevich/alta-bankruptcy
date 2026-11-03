// Официальные документы ALTA. Файлы в public/docs лежат у нас, чтобы остались, если банк снимет их со своего сайта,
// и чтобы открывались в просмотре на сайте: CSP пускает во встроенный просмотр только свой домен.
import type { Lang } from '../i18n';

type Text = Record<Lang, string>;

export type Doc = {
	title: Text;
	what: Text;
	period: Text;
	source: 'apr' | 'bank' | 'aod';
	sourceUrl: string;
	/** Имя копии в public/docs. */
	file: string;
	bytes: number;
	pages: number;
};

const APR = 'https://fin.apr.gov.rs/JavnaPretraga/Home/Index';
const BANK = 'https://altabanka.rs/static/uploads';
const AOD =
	'https://web.archive.org/web/20140308161705/http://www.aod.rs/pdf/2014-02-03-saopstenje.pdf';

export const SOURCE_LABEL: Record<Doc['source'], Text> = {
	apr: { ru: 'Реестр APR', en: 'APR registry', sr: 'Registar APR' },
	bank: { ru: 'Сайт банка', en: 'Bank website', sr: 'Sajt banke' },
	aod: { ru: 'AOD (веб-архив)', en: 'AOD (web archive)', sr: 'AOD (veb-arhiva)' },
};

const y2025: Text = { ru: '2025 год', en: 'Year 2025', sr: 'Godina 2025' };

export const DOCS: Doc[] = [
	{
		title: {
			ru: 'Годовой отчёт 2025 с заключением аудитора',
			en: 'Annual report 2025 with the auditor’s opinion',
			sr: 'Godišnji izveštaj 2025 sa izveštajem revizora',
		},
		what: {
			ru: 'Отчётность и пояснения, заключение Moore Stephens; вклады — с. 105, крупнейшие вкладчики — с. 127.',
			en: 'Statements and notes, Moore Stephens opinion; deposits on p. 105, largest depositors on p. 127.',
			sr: 'Izveštaji i napomene, mišljenje Moore Stephens; depoziti na str. 105, najveći štediše na str. 127.',
		},
		period: y2025,
		source: 'bank',
		sourceUrl: `${BANK}/2026/04/Alta-banka_Izvestaj-revizora_2025_Final-potpisan.pdf`,
		file: 'alta-2025-izvestaj-revizora.pdf',
		bytes: 12094110,
		pages: 246,
	},
	{
		title: {
			ru: 'Пояснения к отчётности 2025 (Napomene)',
			en: 'Notes to the 2025 statements (Napomene)',
			sr: 'Napomene uz izveštaje za 2025.',
		},
		what: {
			ru: 'Вклады по типам клиентов — стр. 94; кредиты связанным лицам — примечание 32, стр. 102.',
			en: 'Deposits by client type on p. 94; loans to related parties in note 32, p. 102.',
			sr: 'Depoziti po vrstama klijenata na str. 94; krediti povezanim licima u napomeni 32, str. 102.',
		},
		period: y2025,
		source: 'apr',
		sourceUrl: APR,
		file: 'alta-2025-napomene-apr.pdf',
		bytes: 6522256,
		pages: 136,
	},
	{
		title: { ru: 'Баланс (Bilans stanja)', en: 'Balance sheet (Bilans stanja)', sr: 'Bilans stanja' },
		what: {
			ru: 'Активы 194,1 млрд RSD, вклады клиентов 154,4 млрд, кредиты клиентам 75,8 млрд, капитал 22,3 млрд.',
			en: 'Assets RSD 194.1 bn, customer deposits 154.4 bn, customer loans 75.8 bn, equity 22.3 bn.',
			sr: 'Aktiva 194,1 mlrd RSD, depoziti klijenata 154,4 mlrd, krediti klijentima 75,8 mlrd, kapital 22,3 mlrd.',
		},
		period: { ru: 'на 31.12.2025', en: 'at 31.12.2025', sr: 'na dan 31.12.2025.' },
		source: 'apr',
		sourceUrl: APR,
		file: 'alta-2025-bilans-stanja.pdf',
		bytes: 76643,
		pages: 3,
	},
	{
		title: { ru: 'Отчёт о прибылях и убытках (Bilans uspeha)', en: 'Income statement (Bilans uspeha)', sr: 'Bilans uspeha' },
		what: {
			ru: 'Чистая прибыль 1,37 млрд RSD (в 2024 году — 1,60 млрд).',
			en: 'Net profit RSD 1.37 bn (1.60 bn in 2024).',
			sr: 'Neto dobit 1,37 mlrd RSD (u 2024. — 1,60 mlrd).',
		},
		period: y2025,
		source: 'apr',
		sourceUrl: APR,
		file: 'alta-2025-bilans-uspeha.pdf',
		bytes: 71090,
		pages: 3,
	},
	{
		title: {
			ru: 'Отчёт о прочем совокупном доходе',
			en: 'Statement of other comprehensive income',
			sr: 'Izveštaj o ostalom rezultatu',
		},
		what: {
			ru: 'Доходы и расходы, не вошедшие в прибыль, форма APR.',
			en: 'Income and expenses outside profit, APR form.',
			sr: 'Prihodi i rashodi van dobiti, obrazac APR.',
		},
		period: y2025,
		source: 'apr',
		sourceUrl: APR,
		file: 'alta-2025-ostali-rezultat.pdf',
		bytes: 60219,
		pages: 3,
	},
	{
		title: {
			ru: 'Отчёт о движении денежных средств',
			en: 'Cash flow statement',
			sr: 'Izveštaj o tokovima gotovine',
		},
		what: {
			ru: 'Откуда пришли и куда ушли деньги банка, форма APR.',
			en: 'Where the bank’s cash came from and went, APR form.',
			sr: 'Odakle je novac banke stizao i kuda je odlazio, obrazac APR.',
		},
		period: y2025,
		source: 'apr',
		sourceUrl: APR,
		file: 'alta-2025-tokovi-gotovine.pdf',
		bytes: 73019,
		pages: 3,
	},
	{
		title: {
			ru: 'Раскрытие информации за 2025 год',
			en: 'Public disclosures for 2025',
			sr: 'Objavljivanje podataka i informacija za 2025.',
		},
		what: {
			ru: 'Обязательное раскрытие банка: капитал и нормативы за год.',
			en: 'The bank’s mandatory disclosure: capital and ratios for the year.',
			sr: 'Obavezno objavljivanje banke: kapital i pokazatelji za godinu.',
		},
		period: { ru: '01.01–31.12.2025', en: '01.01–31.12.2025', sr: '01.01–31.12.2025.' },
		source: 'bank',
		sourceUrl: `${BANK}/2026/05/Objavljivanje-podataka-i-informacija_01.01.2025.-31.12.2025.pdf`,
		file: 'alta-2025-objavljivanje.pdf',
		bytes: 1627448,
		pages: 71,
	},
	{
		title: {
			ru: 'Раскрытие информации за I полугодие 2026',
			en: 'Public disclosures for H1 2026',
			sr: 'Objavljivanje podataka i informacija za I polugodište 2026.',
		},
		what: {
			ru: 'Последнее раскрытие банка: капитал и нормативы ликвидности (LCR, NSFR).',
			en: 'The bank’s latest disclosure: capital, LCR, NSFR.',
			sr: 'Poslednje objavljivanje banke: kapital, LCR, NSFR.',
		},
		period: { ru: '01.01–30.06.2026', en: '01.01–30.06.2026', sr: '01.01–30.06.2026.' },
		source: 'bank',
		sourceUrl: `${BANK}/2026/09/Objavljivanje-podataka-i-informacija_01.01.2026.-30.06.2026.pdf`,
		file: 'alta-2026-h1-objavljivanje.pdf',
		bytes: 852627,
		pages: 21,
	},
	{
		title: {
			ru: 'Основные данные о банке (Obrazac OP)',
			en: 'Basic data about the bank (Obrazac OP)',
			sr: 'Osnovni podaci o banci (Obrazac OP)',
		},
		what: {
			ru: 'Название, адрес, реквизиты и внешний аудитор, одна страница.',
			en: 'Name, address, identifiers and external auditor, one page.',
			sr: 'Naziv, adresa, identifikacioni podaci i spoljni revizor, jedna strana.',
		},
		period: { ru: 'на 30.09.2026', en: 'at 30.09.2026', sr: 'na dan 30.09.2026.' },
		source: 'bank',
		sourceUrl: `${BANK}/2026/10/Obrazac-OP-30.09.2026.pdf`,
		file: 'alta-op-2026-09-30.pdf',
		bytes: 262896,
		pages: 1,
	},
	{
		title: {
			ru: 'Промежуточный отчёт с проверкой аудитора',
			en: 'Interim report with auditor’s review',
			sr: 'Polugodišnji izveštaj sa revizijom',
		},
		what: {
			ru: 'Вклады по типам клиентов — с. 103.',
			en: 'Deposits by client type on p. 103.',
			sr: 'Depoziti po vrstama klijenata na str. 103.',
		},
		period: { ru: 'на 30.06.2025', en: 'at 30.06.2025', sr: 'na dan 30.06.2025.' },
		source: 'bank',
		sourceUrl: `${BANK}/2025/10/Alta-banka_Izvestaj-revizora_30062025_Final-potpisan.pdf`,
		file: 'alta-2025-h1-izvestaj-revizora.pdf',
		bytes: 12182269,
		pages: 239,
	},
	{
		title: {
			ru: 'Годовой отчёт 2024 с заключением аудитора',
			en: 'Annual report 2024 with the auditor’s opinion',
			sr: 'Godišnji izveštaj 2024 sa izveštajem revizora',
		},
		what: {
			ru: 'Для сравнения с 2025 годом.',
			en: 'For comparison with 2025.',
			sr: 'Za poređenje sa 2025.',
		},
		period: { ru: '2024 год', en: 'Year 2024', sr: 'Godina 2024' },
		source: 'bank',
		sourceUrl: `${BANK}/2025/04/Alta-banka_Izvestaj-revizora_2024_Final-potpisan.pdf`,
		file: 'alta-2024-izvestaj-revizora.pdf',
		bytes: 18243955,
		pages: 240,
	},
	{
		title: {
			ru: 'Объявление AOD о выплате по Univerzal banka',
			en: 'AOD payout announcement for Univerzal banka',
			sr: 'Obaveštenje AOD o isplati za Univerzal banku',
		},
		what: {
			ru: 'Объявление 2014 года о выплате до 50 000 €, две страницы.',
			en: 'How AOD announced the payout of up to €50,000 in 2014, two pages.',
			sr: 'Kako je AOD objavila isplatu do 50.000 € 2014, dve strane.',
		},
		period: { ru: '03.02.2014', en: '03.02.2014', sr: '03.02.2014.' },
		source: 'aod',
		sourceUrl: AOD,
		file: 'aod-2014-02-03-saopstenje.pdf',
		bytes: 138774,
		pages: 2,
	},
];
