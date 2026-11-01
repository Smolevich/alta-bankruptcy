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
			ru: 'Квартальный отчёт AOD по Univerzal, III кв. 2020',
			en: 'AOD quarterly report on Univerzal, Q3 2020',
			sr: 'Kvartalni izveštaj AOD o Univerzal banci, III kvartal 2020.',
		},
		date: { ru: 'период 01.07–30.09.2020', en: 'period 01.07–30.09.2020', sr: 'period 01.07–30.09.2020.' },
		main: {
			ru: 'I очередь: выплачено за квартал 591,3 млн динаров (таблица «исплаћено» по очередям).',
			en: 'Rank I: RSD 591.3 m paid in the quarter (the “paid” column of the table by rank).',
			sr: 'I isplatni red: za kvartal isplaćeno 591,3 mil. dinara (kolona „isplaćeno“ u tabeli po redovima).',
		},
		url: 'https://www.aod.rs/uploads/dokumenti/kvartalniizvestaj/192_kvartalni_izvestaj.pdf',
		meta: { ru: 'PDF', en: 'PDF', sr: 'PDF' },
	},
	{
		title: {
			ru: 'Квартальный отчёт AOD по Univerzal, IV кв. 2020',
			en: 'AOD quarterly report on Univerzal, Q4 2020',
			sr: 'Kvartalni izveštaj AOD o Univerzal banci, IV kvartal 2020.',
		},
		date: { ru: 'период 01.10–31.12.2020', en: 'period 01.10–31.12.2020', sr: 'period 01.10–31.12.2020.' },
		main: {
			ru: 'I очередь: выплачено за квартал 359,3 млн динаров (таблица «исплаћено» по очередям).',
			en: 'Rank I: RSD 359.3 m paid in the quarter (the “paid” column of the table by rank).',
			sr: 'I isplatni red: za kvartal isplaćeno 359,3 mil. dinara (kolona „isplaćeno“ u tabeli po redovima).',
		},
		url: 'https://www.aod.rs/uploads/dokumenti/kvartalniizvestaj/277_kvartalni_izvestaj.pdf',
		meta: { ru: 'PDF', en: 'PDF', sr: 'PDF' },
	},
	{
		title: {
			ru: 'Квартальный отчёт AOD по Univerzal, I кв. 2021',
			en: 'AOD quarterly report on Univerzal, Q1 2021',
			sr: 'Kvartalni izveštaj AOD o Univerzal banci, I kvartal 2021.',
		},
		date: { ru: 'период 01.01–31.03.2021', en: 'period 01.01–31.03.2021', sr: 'period 01.01–31.03.2021.' },
		main: {
			ru: 'I очередь: выплачено за квартал 45,1 млн динаров (таблица «исплаћено» по очередям).',
			en: 'Rank I: RSD 45.1 m paid in the quarter (the “paid” column of the table by rank).',
			sr: 'I isplatni red: za kvartal isplaćeno 45,1 mil. dinara (kolona „isplaćeno“ u tabeli po redovima).',
		},
		url: 'https://www.aod.rs/uploads/dokumenti/kvartalniizvestaj/309_kvartalni_izvestaj.pdf',
		meta: { ru: 'PDF', en: 'PDF', sr: 'PDF' },
	},
	{
		title: {
			ru: 'Квартальный отчёт AOD по Univerzal, II кв. 2021',
			en: 'AOD quarterly report on Univerzal, Q2 2021',
			sr: 'Kvartalni izveštaj AOD o Univerzal banci, II kvartal 2021.',
		},
		date: { ru: 'период 01.04–30.06.2021', en: 'period 01.04–30.06.2021', sr: 'period 01.04–30.06.2021.' },
		main: {
			ru: 'I очередь: выплачено за квартал 849,8 млн динаров (таблица «исплаћено» по очередям).',
			en: 'Rank I: RSD 849.8 m paid in the quarter (the “paid” column of the table by rank).',
			sr: 'I isplatni red: za kvartal isplaćeno 849,8 mil. dinara (kolona „isplaćeno“ u tabeli po redovima).',
		},
		url: 'https://www.aod.rs/uploads/dokumenti/kvartalniizvestaj/332_kvartalni_izvestaj.pdf',
		meta: { ru: 'PDF', en: 'PDF', sr: 'PDF' },
	},
	{
		title: {
			ru: 'Квартальный отчёт AOD по Univerzal, III кв. 2021',
			en: 'AOD quarterly report on Univerzal, Q3 2021',
			sr: 'Kvartalni izveštaj AOD o Univerzal banci, III kvartal 2021.',
		},
		date: { ru: 'период 01.07–30.09.2021', en: 'period 01.07–30.09.2021', sr: 'period 01.07–30.09.2021.' },
		main: {
			ru: 'I очередь: выплачено за квартал 158,9 млн динаров (таблица «исплаћено» по очередям).',
			en: 'Rank I: RSD 158.9 m paid in the quarter (the “paid” column of the table by rank).',
			sr: 'I isplatni red: za kvartal isplaćeno 158,9 mil. dinara (kolona „isplaćeno“ u tabeli po redovima).',
		},
		url: 'https://www.aod.rs/uploads/dokumenti/kvartalniizvestaj/346_kvartalni_izvestaj.pdf',
		meta: { ru: 'PDF', en: 'PDF', sr: 'PDF' },
	},
	{
		title: {
			ru: 'Квартальный отчёт AOD по Univerzal, IV кв. 2021',
			en: 'AOD quarterly report on Univerzal, Q4 2021',
			sr: 'Kvartalni izveštaj AOD o Univerzal banci, IV kvartal 2021.',
		},
		date: { ru: 'период 01.10–31.12.2021', en: 'period 01.10–31.12.2021', sr: 'period 01.10–31.12.2021.' },
		main: {
			ru: 'I очередь: выплачено за квартал 4,8 млн динаров (таблица «исплаћено» по очередям).',
			en: 'Rank I: RSD 4.8 m paid in the quarter (the “paid” column of the table by rank).',
			sr: 'I isplatni red: za kvartal isplaćeno 4,8 mil. dinara (kolona „isplaćeno“ u tabeli po redovima).',
		},
		url: 'https://www.aod.rs/uploads/dokumenti/kvartalniizvestaj/377_kvartalni_izvestaj.pdf',
		meta: { ru: 'PDF', en: 'PDF', sr: 'PDF' },
	},
	{
		title: {
			ru: 'Квартальный отчёт AOD по Univerzal banka, II квартал 2026',
			en: 'AOD quarterly report on Univerzal banka, Q2 2026',
			sr: 'Kvartalni izveštaj AOD o Univerzal banci, II kvartal 2026.',
		},
		date: same('30.06.2026'),
		main: {
			ru: 'Таблица по очередям: остаток на начало, изменение, выплата и остаток на конец квартала. По I очереди остаток 72,8 млн динаров.',
			en: 'A table by rank: opening balance, change, payout and closing balance for the quarter. Rank I balance: RSD 72.8 m.',
			sr: 'Tabela po isplatnim redovima: početno stanje, promena, isplata i stanje na kraju kvartala. Saldo I reda: 72,8 mil. dinara.',
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

// «На что смотреть»: страница и пункты по самим PDF (pdftotext/OCR). Подсветки внутри PDF нет, только указатели.
// Имена и адреса из списков кредиторов сюда не попадают: описан только шаблон строки.
type Look = { page: number; look: Record<Lang, string[]>; embed: boolean };

const COLUMNS: Record<Lang, string> = {
	ru: 'Колонки таблицы: «Утврђено потраживање» (Utvrđeno potraživanje) — признанная сумма; «Проценат намирења» (Procenat namirenja) — доля, которую платят этим распределением; «Износ за исплату» (Iznos za isplatu) — сколько получает кредитор, в динарах.',
	en: 'Table columns: “Утврђено потраживање” (Utvrđeno potraživanje) is the recognised amount; “Проценат намирења” (Procenat namirenja) is the share paid in this distribution; “Износ за исплату” (Iznos za isplatu) is what the creditor receives, in dinars.',
	sr: 'Kolone tabele: „Утврђено потраживање“ (Utvrđeno potraživanje) je priznati iznos; „Проценат намирења“ (Procenat namirenja) je udeo koji se isplaćuje ovom deobom; „Износ за исплату“ (Iznos za isplatu) je iznos koji poverilac dobija, u dinarima.',
};

const WHO: Record<Lang, string> = {
	ru: 'Кто есть кто: у физлиц имя, город и адрес, без «МБ» и «ПИБ»; у фирм организационная форма (ДОО, АД, ЈКП) и «МБ: …, ПИБ: …». ИП в списке не помечены: их можно узнать лишь косвенно, по имени и фамилии с «ПИБ» без «МБ» (редко встречается «СЗР» — самостоятельная ремесленная лавка). Имена в таблице — реальные люди. В латинице «МБ» и «ПИБ» пишутся MB и PIB.',
	en: 'Who is who: individuals have a name, city and address with no “МБ” or “ПИБ”; companies have a legal form (ДОО, АД, ЈКП) and “МБ: …, ПИБ: …”. Sole traders are not marked: they can only be guessed from a personal name with a “ПИБ” but no “МБ” (“СЗР”, a craft shop, appears rarely). The names in the table are real people. In Latin script “МБ” and “ПИБ” are written MB and PIB.',
	sr: 'Ko je ko: fizička lica imaju ime, grad i adresu bez „МБ“ i „ПИБ“; pravna lica imaju oblik (ДОО, АД, ЈКП) i „МБ: …, ПИБ: …“. Preduzetnici nisu označeni: mogu se prepoznati samo posredno, po imenu i prezimenu sa „ПИБ“ bez „МБ“ (retko se javlja „СЗР“, samostalna zanatska radnja). Imena u tabeli su stvarni ljudi. Latinicom „МБ“ i „ПИБ“ glase MB i PIB.',
};

const draft = (page: number, total: number, pct: string, extra?: Record<Lang, string>): Look => ({
	page,
	embed: true,
	look: {
		ru: [`Стр. ${page}: фраза о проценте («проценат намирења … би износио ${pct}») и начало таблицы «Листа стечајних поверилаца I исплатног реда» (Lista stečajnih poverilaca I isplatnog reda). Итоговая строка «УКУПНО» (Ukupno) — на стр. ${total}. Файлы бывают в кириллице и в латинице.`, COLUMNS.ru, WHO.ru, ...(extra ? [extra.ru] : [])],
		en: [`Page ${page}: the sentence on the percentage (“проценат намирења … би износио ${pct}”) and the start of the table “Листа стечајних поверилаца I исплатног реда” (Lista stečajnih poverilaca I isplatnog reda). The “УКУПНО” (Ukupno) total line is on page ${total}. Files come in either Cyrillic or Latin script.`, COLUMNS.en, WHO.en, ...(extra ? [extra.en] : [])],
		sr: [`Str. ${page}: rečenica o procentu („проценат намирења … би износио ${pct}“) i početak tabele „Листа стечајних поверилаца I исплатног реда“ (Lista stečajnih poverilaca I isplatnog reda). Ukupan zbir „УКУПНО“ (Ukupno) je na str. ${total}. Fajlovi su na ćirilici ili latinici.`, COLUMNS.sr, WHO.sr, ...(extra ? [extra.sr] : [])],
	},
});

const scan = (pct: string): Look => ({
	page: 1,
	embed: true,
	look: {
		ru: ['Стр. 1: решение суда: дата, состояние средств и сумма распределения. Файл — скан, текст из него не копируется.', `Со стр. 2: таблица кредиторов IV очереди, в ней процент ${pct}. Колонки те же: признанная сумма, процент, сумма к выплате.`, 'Имена в таблице — реальные люди и фирмы; нам нужны только колонки с суммами и процентами.'],
		en: ['Page 1: the court decision: date, the funds available and the amount distributed. The file is a scan, its text cannot be copied.', `From page 2: the table of rank IV creditors with the percentage ${pct}. Same columns: recognised amount, percentage, amount to be paid.`, 'The names in the table are real people and companies; only the columns with amounts and percentages matter here.'],
		sr: ['Str. 1: rešenje suda: datum, raspoloživa sredstva i iznos deobe. Fajl je sken, tekst se ne može kopirati.', `Od str. 2: tabela poverilaca IV reda sa procentom ${pct}. Iste kolone: utvrđeni iznos, procenat, iznos za isplatu.`, 'Imena u tabeli su stvarni ljudi i firme; ovde su važne samo kolone sa iznosima i procentima.'],
	},
});

const quarter = (page: number, note?: Record<Lang, string>): Look => ({
	page,
	embed: true,
	look: {
		ru: [`Стр. ${page}: таблица «3г Готовински одливи – утврђена потраживања поверилаца према стечајном дужнику» (в файле она может быть латиницей: «3g Gotovinski odlivi …») и в ней строка «I исплатни ред» (I isplatni red). Таблица может начинаться ниже середины страницы, листайте вниз.`, 'Колонки: потраживания на начало периода; повышение по итогам заседаний и начисления процентов; «Исплаћена потраживања у извештајном периоду или смањење по основу окончаних парничних поступака»; остаток на конец периода.', 'Третья колонка смешивает выплаты и уменьшения по оконченным судебным делам. Для I очереди в 2020–2021 годах это в основном выплаты по распределениям.', ...(note ? [note.ru] : [])],
		en: [`Page ${page}: the table “3г Готовински одливи – утврђена потраживања поверилаца према стечајном дужнику” (in the file it may be in Latin script: “3g Gotovinski odlivi …”) and in it the “I исплатни ред” (I isplatni red) row. The table may start low on the page, so scroll down.`, 'Columns: claims at the start of the period; increase from hearings and interest accrual; “Исплаћена потраживања у извештајном периоду или смањење по основу окончаних парничних поступака”; balance at the end of the period.', 'The third column mixes payouts with reductions from concluded lawsuits. For rank I in 2020–2021 it is mostly payouts from the distributions.', ...(note ? [note.en] : [])],
		sr: [`Str. ${page}: tabela „3г Готовински одливи – утврђена потраживања поверилаца према стечајном дужнику“ (u fajlu može biti latinicom: „3g Gotovinski odlivi …“) i u njoj red „I исплатни ред“ (I isplatni red). Tabela može početi pri dnu strane, listajte nadole.`, 'Kolone: potraživanja na početku perioda; povećanje po ispitnim ročištima i obračunu kamate; „Исплаћена потраживања у извештајном периоду или смањење по основу окончаних парничних поступака“; stanje na kraju perioda.', 'Treća kolona meša isplate sa smanjenjima po okončanim parnicama. Za I red u 2020–2021. to su uglavnom isplate po deobama.', ...(note ? [note.sr] : [])],
	},
});

const BASE = 'https://www.aod.rs/uploads/dokumenti';

export const LOOK: Record<string, Look> = {
	[`${BASE}/oglas/24_2_oglas.pdf`]: draft(4, 63, '50 %'),
	[`${BASE}/oglas/44_1_oglas.pdf`]: draft(4, 63, '40 %'),
	[`${BASE}/oglas/49_1_oglas.pdf`]: draft(4, 72, '10 %', {
		ru: 'Дальше в файле: списки II и III очередей (по 100 %, итог II — стр. 73) и IV очереди (2,90 %, итог — стр. 149).',
		en: 'Further in the file: the lists for ranks II and III (100% each, the rank II total is on page 73) and rank IV (2.90%, the total is on page 149).',
		sr: 'Dalje u fajlu: spiskovi II i III reda (po 100 %, zbir II reda je na str. 73) i IV reda (2,90 %, zbir je na str. 149).',
	}),
	[`${BASE}/oglas/77_1_oglas.pdf`]: scan('6,00 %'),
	[`${BASE}/oglas/115_1_oglas.pdf`]: scan('1,85 %'),
	[`${BASE}/oglas/212_1_oglas.pdf`]: scan('0,69 %'),
	[`${BASE}/oglas/161_1_oglas.pdf`]: {
		page: 5,
		embed: true,
		look: {
			ru: ['Стр. 5: пункт III — шестое распределение: IV очередь, 2,30 %, 150,1 млн динаров. Это предложение управляющего, а не решение суда.', 'Стр. 6–68: таблица кредиторов IV очереди; итоговая сумма — на стр. 68. Колонки те же: признанная сумма, процент, сумма к выплате.', WHO.ru],
			en: ['Page 5: point III, the sixth distribution: rank IV, 2.30%, RSD 150.1 m. This is the administrator’s proposal, not a court decision.', 'Pages 6 to 68: the table of rank IV creditors; the total is on page 68. Same columns: recognised amount, percentage, amount to be paid.', WHO.en],
			sr: ['Str. 5: tačka III, šesta deoba: IV red, 2,30 %, 150,1 mil. dinara. To je predlog upravnika, a ne rešenje suda.', 'Str. 6–68: tabela poverilaca IV reda; zbir je na str. 68. Iste kolone: utvrđeni iznos, procenat, iznos za isplatu.', WHO.sr],
		},
	},
	[`${BASE}/oglas/19_1_oglas.pdf`]: {
		page: 1,
		embed: true,
		look: {
			ru: ['Одна страница: что прислать кредитору, чтобы получить выплату.', 'Физлицо: копия удостоверения личности, номер счёта, телефон. Фирма и ИП: выписка из реестра, номер счёта. Наследники: документы о правопреемстве.', 'Внизу — адрес и контакты, куда присылать реквизиты (в письменной форме).'],
			en: ['One page: what a creditor must send in order to be paid.', 'An individual: a copy of the ID card, account number, phone. A company or sole trader: the registry extract, account number. Heirs: documents proving succession.', 'At the bottom: the address and contacts for sending the details (in writing).'],
			sr: ['Jedna strana: šta poverilac treba da pošalje da bi bio isplaćen.', 'Fizičko lice: kopija lične karte, broj računa, telefon. Pravno lice i preduzetnik: izvod iz registra, broj računa. Naslednici: dokazi o pravnom sledbeništvu.', 'Dole su adresa i kontakti za slanje podataka (u pisanoj formi).'],
		},
	},
	[`${BASE}/kvartalniizvestaj/192_kvartalni_izvestaj.pdf`]: quarter(3),
	[`${BASE}/kvartalniizvestaj/277_kvartalni_izvestaj.pdf`]: quarter(3),
	[`${BASE}/kvartalniizvestaj/309_kvartalni_izvestaj.pdf`]: quarter(2),
	[`${BASE}/kvartalniizvestaj/332_kvartalni_izvestaj.pdf`]: quarter(2),
	[`${BASE}/kvartalniizvestaj/346_kvartalni_izvestaj.pdf`]: quarter(2),
	[`${BASE}/kvartalniizvestaj/377_kvartalni_izvestaj.pdf`]: quarter(2),
	[`${BASE}/kvartalniizvestaj/Univerzal%20banka_II%20kvartal%202026.pdf`]: quarter(3, {
		ru: 'Здесь же: остаток по I очереди — 72,8 млн динаров, по IV очереди — 5 383,4 млн из признанных 6 525,3 млн.',
		en: 'Same table: the rank I balance is RSD 72.8 m; rank IV has RSD 5,383.4 m left of 6,525.3 m recognised.',
		sr: 'U istoj tabeli: saldo I reda je 72,8 mil. dinara; kod IV reda ostaje 5.383,4 od utvrđenih 6.525,3 mil. dinara.',
	}),
};
