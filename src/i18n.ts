// Строки интерфейса трёх языков. Тексты страниц лежат в src/content, здесь только оболочка.
export type Lang = 'ru' | 'en' | 'sr';

export const LANGS: Lang[] = ['ru', 'en', 'sr'];

export function langOf(starlightLang: string | undefined): Lang {
	if (starlightLang?.startsWith('en')) return 'en';
	if (starlightLang?.startsWith('sr')) return 'sr';
	return 'ru';
}

/** Русский — корень сайта, остальные под префиксом. */
export function href(lang: Lang, path: string): string {
	const p = path.startsWith('/') ? path : `/${path}`;
	return lang === 'ru' ? p : `/${lang}${p}`;
}

export const LOCALE_TAG: Record<Lang, string> = { ru: 'ru-RU', en: 'en-GB', sr: 'sr-Latn-RS' };

export const UI = {
	ru: {
		sources: 'Источники',
		checked: 'сверено',
		official: 'Официальный источник',
		reliable_media: 'Надёжное СМИ',
		unverified: 'Не подтверждено',
		footerHelp: 'Нашли ошибку? Нужен источник —',
		footerHelpLink: 'как предложить правку',
		footerNote: 'Сайт не юридическая консультация.',
		statusNow: 'Сейчас: стадия',
		of: 'из',
		checkedOn: 'Проверено',
		statusUpdate: 'Обновляем при каждой официальной новости.',
		allStages: 'Все стадии',
		publisher: { aod: 'AOD', nbs: 'Нацбанк', bank: 'Сайт банка', court: 'Суд' },
		forIp: 'Для ИП',
		flowLabel: 'Разделы сайта по порядку',
		flowOpen: 'Открыть',
		acct: {
			title: 'Где открыть счёт для выплаты',
			blurb: 'Когда AOD объявит банк-плательщика и порядок выплат, деньги нужно будет куда-то перевести. Вкладчики делятся, в каких банках получилось открыть личный счёт и счёт ИП или бизнес-счёт.',
			stats: 'Статистика по банкам',
			share: 'Поделиться своим опытом',
		},
		docs: { pages: 'стр.', source: 'Источник', open: 'Открыть PDF', openSource: 'Открыть на сайте банка', period: 'Период', mb: 'МБ', label: 'Список документов' },
		flow: [
			['/procedura/', 'Процедура и сроки', 'Семь стадий от отзыва лицензии до выплат'],
			['/trebovanie/', 'Требование сверх 50 000 €', 'Кто, куда и в какой срок подаёт'],
			['/novosti/', 'Новости', 'Сообщения AOD, Нацбанка и банка'],
			['/kak-bylo/', 'Как было (Univerzal)', 'Что получили вкладчики в 2014 году'],
			['/bank/', 'Банк', 'Владелец и руководство по реестрам'],
			['/dokumenty/', 'Документы банка', 'Отчётность и отчёты аудитора, PDF из первоисточников'],
			['/zakony/', 'Законы', 'Статьи, на которых стоят сроки'],
			['/pomoch/', 'Как помочь', 'Исправить ошибку или добавить источник'],
		],
	},
	en: {
		sources: 'Sources',
		checked: 'checked',
		official: 'Official source',
		reliable_media: 'Reliable media',
		unverified: 'Unverified',
		footerHelp: 'Found a mistake? A source is required —',
		footerHelpLink: 'how to suggest a correction',
		footerNote: 'This site is not legal advice.',
		statusNow: 'Now: stage',
		of: 'of',
		checkedOn: 'Checked',
		statusUpdate: 'Updated with every official announcement.',
		allStages: 'All stages',
		publisher: { aod: 'AOD', nbs: 'National Bank', bank: 'Bank website', court: 'Court' },
		forIp: 'For sole traders',
		flowLabel: 'Site sections in order',
		flowOpen: 'Open',
		acct: {
			title: 'Where to open an account for the payout',
			blurb: 'Once AOD names the paying bank and the payout procedure, the money will have to be sent somewhere. Depositors share which banks let them open a personal account and a sole-trader or business account.',
			stats: 'Statistics by bank',
			share: 'Share your experience',
		},
		docs: { pages: 'pp.', source: 'Source', open: 'Open PDF', openSource: 'Open on the bank’s website', period: 'Period', mb: 'MB', label: 'List of documents' },
		flow: [
			['/procedura/', 'Procedure and timeline', 'Seven stages from licence revocation to payouts'],
			['/trebovanie/', 'Claim above €50,000', 'Who files, where and by when'],
			['/novosti/', 'News', 'Announcements from AOD, the National Bank and the bank'],
			['/kak-bylo/', 'Past cases (Univerzal)', 'What depositors received in 2014'],
			['/bank/', 'The bank', 'Owner and management from registries'],
			['/dokumenty/', 'Bank documents', 'Statements and audit reports, PDFs from primary sources'],
			['/zakony/', 'Laws', 'The articles behind the deadlines'],
			['/pomoch/', 'How to help', 'Fix a mistake or add a source'],
		],
	},
	sr: {
		sources: 'Izvori',
		checked: 'proveren',
		official: 'Zvanični izvor',
		reliable_media: 'Pouzdani mediji',
		unverified: 'Nepotvrđeno',
		footerHelp: 'Našli ste grešku? Potreban je izvor —',
		footerHelpLink: 'kako predložiti ispravku',
		footerNote: 'Sajt nije pravni savet.',
		statusNow: 'Sada: faza',
		of: 'od',
		checkedOn: 'Provereno',
		statusUpdate: 'Ažuriramo uz svaku zvaničnu vest.',
		allStages: 'Sve faze',
		publisher: { aod: 'AOD', nbs: 'NBS', bank: 'Sajt banke', court: 'Sud' },
		forIp: 'Za preduzetnike',
		flowLabel: 'Odeljci sajta redom',
		flowOpen: 'Otvori',
		acct: {
			title: 'Gde otvoriti račun za isplatu',
			blurb: 'Kada AOD objavi banku isplatioca i postupak isplate, novac će trebati negde preneti. Štediše dele u kojim bankama su uspele da otvore lični račun i račun preduzetnika ili poslovni račun.',
			stats: 'Statistika po bankama',
			share: 'Podelite svoje iskustvo',
		},
		docs: { pages: 'str.', source: 'Izvor', open: 'Otvori PDF', openSource: 'Otvori na sajtu banke', period: 'Period', mb: 'MB', label: 'Spisak dokumenata' },
		flow: [
			['/procedura/', 'Postupak i rokovi', 'Sedam faza od oduzimanja dozvole do isplata'],
			['/trebovanie/', 'Potraživanje iznad 50.000 €', 'Ko, gde i do kada prijavljuje'],
			['/novosti/', 'Vesti', 'Saopštenja AOD, NBS i banke'],
			['/kak-bylo/', 'Kako je bilo (Univerzal)', 'Šta su štediše dobile 2014.'],
			['/bank/', 'Banka', 'Vlasnik i rukovodstvo iz registara'],
			['/dokumenty/', 'Dokumenta banke', 'Izveštaji i izveštaji revizora, PDF iz izvora'],
			['/zakony/', 'Zakoni', 'Članovi na kojima stoje rokovi'],
			['/pomoch/', 'Kako pomoći', 'Ispraviti grešku ili dodati izvor'],
		],
	},
} as const;
