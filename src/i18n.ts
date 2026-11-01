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
	},
} as const;
