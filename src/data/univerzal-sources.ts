// Первоисточники по Univerzal banka: что в каждом документе, указано по самому тексту PDF/страницы.
// Списки кредиторов в документах AOD содержат имена людей, здесь их нет: только очередь, процент и сумма.
import type { Lang } from '../i18n';

type Text = Record<Lang, string>;

export type Source = {
	title: Text;
	date: Text;
	main: Text;
	url: string;
	/** Подпись у ссылки: PDF с размером или страница. */
	meta: Text;
};

const AOD = 'https://www.aod.rs/uploads/dokumenti/oglas';
const same = (s: string): Text => ({ ru: s, en: s, sr: s });

export const UNIVERZAL_SOURCES: Source[] = [
	{
		title: {
			ru: 'Первое частичное распределение: проект решения',
			en: 'First partial distribution: draft decision',
			sr: 'Prva delimična deoba: nacrt rešenja',
		},
		date: { ru: 'проект подан 16.07.2020; решение суда 18.08.2020', en: 'draft filed 16.07.2020; court decision 18.08.2020', sr: 'nacrt podnet 16.07.2020; rešenje suda 18.08.2020' },
		main: {
			ru: 'I очередь: 50 % признанного требования, всего 1 043,7 млн динаров.',
			en: 'Rank I: 50% of the recognised claim, RSD 1,043.7 m in total.',
			sr: 'I isplatni red: 50% utvrđenog potraživanja, ukupno 1.043,7 mil. dinara.',
		},
		url: `${AOD}/24_2_oglas.pdf`,
		meta: { ru: 'PDF, 64 стр., 2,0 МБ', en: 'PDF, 64 pp., 2.0 MB', sr: 'PDF, 64 str., 2,0 MB' },
	},
	{
		title: {
			ru: 'Второе частичное распределение: проект решения',
			en: 'Second partial distribution: draft decision',
			sr: 'Druga delimična deoba: nacrt rešenja',
		},
		date: { ru: 'проект подан 18.03.2021; решение суда 07.04.2021', en: 'draft filed 18.03.2021; court decision 07.04.2021', sr: 'nacrt podnet 18.03.2021; rešenje suda 07.04.2021' },
		main: {
			ru: 'I очередь: ещё 40 %, всего 834,9 млн динаров.',
			en: 'Rank I: a further 40%, RSD 834.9 m in total.',
			sr: 'I isplatni red: još 40%, ukupno 834,9 mil. dinara.',
		},
		url: `${AOD}/44_1_oglas.pdf`,
		meta: { ru: 'PDF, 63 стр., 2,0 МБ', en: 'PDF, 63 pp., 2.0 MB', sr: 'PDF, 63 str., 2,0 MB' },
	},
	{
		title: {
			ru: 'Третье частичное распределение: проект решения',
			en: 'Third partial distribution: draft decision',
			sr: 'Treća delimična deoba: nacrt rešenja',
		},
		date: { ru: 'проект подан 25.05.2021; решение суда 15.06.2021', en: 'draft filed 25.05.2021; court decision 15.06.2021', sr: 'nacrt podnet 25.05.2021; rešenje suda 15.06.2021' },
		main: {
			ru: 'I очередь: последние 10 %; II и III очереди: по 100 %; IV очередь: 2,90 %. Всего 449,9 млн динаров.',
			en: 'Rank I: the last 10%; ranks II and III: 100% each; rank IV: 2.90%. RSD 449.9 m in total.',
			sr: 'I red: poslednjih 10%; II i III red: po 100%; IV red: 2,90%. Ukupno 449,9 mil. dinara.',
		},
		url: `${AOD}/49_1_oglas.pdf`,
		meta: { ru: 'PDF, 150 стр., 1,2 МБ', en: 'PDF, 150 pp., 1.2 MB', sr: 'PDF, 150 str., 1,2 MB' },
	},
	{
		title: {
			ru: 'Четвёртое частичное распределение: решение суда',
			en: 'Fourth partial distribution: court decision',
			sr: 'Četvrta delimična deoba: rešenje suda',
		},
		date: same('18.04.2022'),
		main: {
			ru: 'IV очередь (крупные компании): 6,00 %, всего 391,5 млн динаров.',
			en: 'Rank IV (large companies): 6.00%, RSD 391.5 m in total.',
			sr: 'IV isplatni red (velika pravna lica): 6,00%, ukupno 391,5 mil. dinara.',
		},
		url: `${AOD}/77_1_oglas.pdf`,
		meta: { ru: 'PDF-скан, 75 стр., 3,8 МБ', en: 'Scanned PDF, 75 pp., 3.8 MB', sr: 'PDF-skeniran, 75 str., 3,8 MB' },
	},
	{
		title: {
			ru: 'Пятое частичное распределение: решение суда',
			en: 'Fifth partial distribution: court decision',
			sr: 'Peta delimična deoba: rešenje suda',
		},
		date: same('03.04.2023'),
		main: {
			ru: 'IV очередь: 1,85 %, всего 120,7 млн динаров.',
			en: 'Rank IV: 1.85%, RSD 120.7 m in total.',
			sr: 'IV isplatni red: 1,85%, ukupno 120,7 mil. dinara.',
		},
		url: `${AOD}/115_1_oglas.pdf`,
		meta: { ru: 'PDF-скан, 73 стр., 0,8 МБ', en: 'Scanned PDF, 73 pp., 0.8 MB', sr: 'PDF-skeniran, 73 str., 0,8 MB' },
	},
	{
		title: {
			ru: 'Шестое частичное распределение: проект решения',
			en: 'Sixth partial distribution: draft decision',
			sr: 'Šesta delimična deoba: nacrt rešenja',
		},
		date: { ru: 'проект подан 14.05.2024', en: 'draft filed 14.05.2024', sr: 'nacrt podnet 14.05.2024' },
		main: {
			ru: 'IV очередь: 2,30 %, всего 150,1 млн динаров. Предложение управляющего; решения суда по нему здесь нет.',
			en: 'Rank IV: 2.30%, RSD 150.1 m in total. A proposal, not a court decision.',
			sr: 'IV isplatni red: 2,30%, ukupno 150,1 mil. dinara. Predlog, a ne rešenje suda.',
		},
		url: `${AOD}/161_1_oglas.pdf`,
		meta: { ru: 'PDF, 69 стр., 2,9 МБ', en: 'PDF, 69 pp., 2.9 MB', sr: 'PDF, 69 str., 2,9 MB' },
	},
	{
		title: {
			ru: 'Седьмое частичное распределение: решение суда',
			en: 'Seventh partial distribution: court decision',
			sr: 'Sedma delimična deoba: rešenje suda',
		},
		date: same('27.05.2025'),
		main: {
			ru: 'IV очередь: 0,69 %, всего 45,0 млн динаров.',
			en: 'Rank IV: 0.69%, RSD 45.0 m in total.',
			sr: 'IV isplatni red: 0,69%, ukupno 45,0 mil. dinara.',
		},
		url: `${AOD}/212_1_oglas.pdf`,
		meta: { ru: 'PDF-скан, 81 стр., 2,7 МБ', en: 'Scanned PDF, 81 pp., 2.7 MB', sr: 'PDF-skeniran, 81 str., 2,7 MB' },
	},
	{
		title: {
			ru: 'Призыв к кредиторам прислать реквизиты для выплаты',
			en: 'Call to creditors to send payment details',
			sr: 'Poziv poveriocima za dostavljanje instrukcija za uplatu',
		},
		date: { ru: 'к первой выплате, 2020 (на дату решения 18.08.2020)', en: 'for the first payout, 2020 (cites the 18.08.2020 decision)', sr: 'uz prvu isplatu, 2020. (poziva se na rešenje od 18.08.2020.)' },
		main: {
			ru: 'Что прислать: физлицу — копию удостоверения личности, номер счёта, телефон; фирме и ИП — выписку из реестра, номер счёта; наследникам — документы о правопреемстве.',
			en: 'What to send: an individual, a copy of the ID card, account number and phone; a company or sole trader, the registry extract and account number; heirs, documents proving succession.',
			sr: 'Šta poslati: fizičko lice kopiju lične karte, broj računa i telefon; pravno lice i preduzetnik izvod iz registra i broj računa; naslednici dokaze o pravnom sledbeništvu.',
		},
		url: `${AOD}/19_1_oglas.pdf`,
		meta: { ru: 'PDF, 1 стр.', en: 'PDF, 1 p.', sr: 'PDF, 1 str.' },
	},
	{
		title: {
			ru: 'Квартальный отчёт AOD по Univerzal banka, II квартал 2026',
			en: 'AOD quarterly report on Univerzal banka, Q2 2026',
			sr: 'Kvartalni izveštaj AOD o Univerzal banci, II kvartal 2026.',
		},
		date: same('30.06.2026'),
		main: {
			ru: 'Таблица по очередям: остаток на начало, изменение, выплата и остаток на конец квартала.',
			en: 'A table by rank: opening balance, change, payout and closing balance for the quarter.',
			sr: 'Tabela po isplatnim redovima: početno stanje, promena, isplata i stanje na kraju kvartala.',
		},
		url: 'https://www.aod.rs/uploads/dokumenti/kvartalniizvestaj/Univerzal%20banka_II%20kvartal%202026.pdf',
		meta: { ru: 'PDF, 0,3 МБ', en: 'PDF, 0.3 MB', sr: 'PDF, 0,3 MB' },
	},
	{
		title: { ru: 'Список всех квартальных отчётов AOD', en: 'List of all AOD quarterly reports', sr: 'Spisak svih kvartalnih izveštaja AOD' },
		date: { ru: 'страница обновляется', en: 'page is updated', sr: 'stranica se ažurira' },
		main: {
			ru: 'Отчёты по всем банкам в банкротстве; нужный — по Univerzal banka.',
			en: 'Reports for all banks in bankruptcy; pick the one for Univerzal banka.',
			sr: 'Izveštaji za sve banke u stečaju; izaberite onaj za Univerzal banku.',
		},
		url: 'https://www.aod.rs/clan/stecajlikv/kvartal_izvest',
		meta: { ru: 'страница aod.rs', en: 'aod.rs page', sr: 'stranica aod.rs' },
	},
	{
		title: { ru: 'Архив объявлений AOD', en: 'AOD notice archive', sr: 'Arhiva oglasa AOD' },
		date: { ru: 'страница обновляется', en: 'page is updated', sr: 'stranica se ažurira' },
		main: {
			ru: 'Все объявления AOD по банкам в банкротстве, включая решения о распределениях выше.',
			en: 'All AOD notices on banks in bankruptcy, including the distribution decisions above.',
			sr: 'Svi oglasi AOD o bankama u stečaju, uključujući gore navedene odluke o deobama.',
		},
		url: 'https://www.aod.rs/clan/oglasdok/arhiva',
		meta: { ru: 'страница aod.rs', en: 'aod.rs page', sr: 'stranica aod.rs' },
	},
	{
		title: { ru: 'Дело Univerzal на сайте AOD', en: 'The Univerzal case on the AOD website', sr: 'Predmet Univerzal banke na sajtu AOD' },
		date: { ru: 'страница обновляется', en: 'page is updated', sr: 'stranica se ažurira' },
		main: {
			ru: 'Процедуры в работе: сведения управляющего о ходе банкротства.',
			en: 'Procedures in progress: the administrator’s information on the bankruptcy.',
			sr: 'Postupci u toku: podaci stečajnog upravnika o toku stečaja.',
		},
		url: 'https://www.aod.rs/clan/stecajlikv/postupci_utoku',
		meta: { ru: 'страница aod.rs', en: 'aod.rs page', sr: 'stranica aod.rs' },
	},
	{
		title: {
			ru: 'Дело в суде: Привредни суд у Београду, 1 Ст 19/2014',
			en: 'The court case: Commercial Court in Belgrade, 1 St 19/2014',
			sr: 'Sudski predmet: Privredni sud u Beogradu, 1 St 19/2014',
		},
		date: { ru: 'открыто 03.02.2014', en: 'opened 03.02.2014', sr: 'otvoren 03.02.2014.' },
		main: {
			ru: 'Как найти: на портале выберите Привредни суд у Београду, тип дела «Ст», номер 19, год 2014.',
			en: 'How to find it: on the portal choose the Commercial Court in Belgrade, case type “St”, number 19, year 2014.',
			sr: 'Kako pronaći: na portalu izaberite Privredni sud u Beogradu, vrstu predmeta „St“, broj 19, godinu 2014.',
		},
		url: 'https://tpson.portal.sud.rs/tpprvs',
		meta: { ru: 'портал судов Сербии', en: 'Serbian courts portal', sr: 'portal sudova Srbije' },
	},
	{
		title: { ru: 'Монография AOD о страховании вкладов', en: 'AOD monograph on deposit insurance', sr: 'Monografija AOD o osiguranju depozita' },
		date: same('2022'),
		main: {
			ru: 'Как работала страховка и банкротства банков с 2002 года, включая прежние лимиты.',
			en: 'How deposit insurance and bank bankruptcies worked since 2002, including earlier limits.',
			sr: 'Kako su funkcionisali osiguranje depozita i stečajevi banaka od 2002, uključujući ranije limite.',
		},
		url: 'https://www.aod.rs/downloads/aod_monografija.pdf',
		meta: { ru: 'PDF, около 100 МБ', en: 'PDF, about 100 MB', sr: 'PDF, oko 100 MB' },
	},
];
