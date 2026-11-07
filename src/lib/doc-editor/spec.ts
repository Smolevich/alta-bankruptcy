// Описание документа для DocEditor. Подписи и подсказки полей живут в i18n.ts в UI[lang][text]
// (title, privacy, about, groups[key], fields[name] = [подпись, подсказка]), здесь — только структура.
export type DocField = {
	name: string;
	// Как поле называется в самом бланке (сербский), показывается рядом с подписью.
	sr?: string;
	// text — одна строка; lines — textarea, в сборщик уходит массив строк.
	type?: 'text' | 'lines';
	value?: string;
};

export type DocSpec = {
	// Ключ сборщика в builders.ts.
	id: string;
	// id на странице: ссылка #anchor открывает редактор.
	anchor: string;
	// Ключ раздела текстов в UI[lang].
	text: 'prijava';
	fileName: string;
	fonts: { regular: string; bold: string };
	groups: { key: string; fields: DocField[] }[];
};

export type DocValues = Record<string, string | string[]>;
export type DocFonts = { regular: ArrayBuffer; bold: ArrayBuffer };
export type DocBuilder = (values: DocValues, fonts: DocFonts) => Promise<Uint8Array>;
