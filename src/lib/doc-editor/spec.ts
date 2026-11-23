// Document description for DocEditor. Field labels and hints live in i18n.ts in UI[lang][text]
// (title, privacy, about, groups[key], fields[name] = [label, hint]); here is only the structure.
export type DocField = {
	name: string;
	// What the field is called in the form itself (Serbian), shown next to the label.
	sr?: string;
	// text is one line; lines is a textarea, an array of lines goes to the builder.
	type?: 'text' | 'lines';
	value?: string;
};

export type DocSpec = {
	// Builder key in builders.ts.
	id: string;
	// id on the page: an #anchor link opens the editor.
	anchor: string;
	// Key of the text section in UI[lang].
	text: 'prijava';
	fileName: string;
	fonts: { regular: string; bold: string };
	groups: { key: string; fields: DocField[] }[];
	// The builder yields editable blocks (blockLists in builders.ts): the form shows a "Document text" section.
	blocks?: boolean;
};

export type DocValues = Record<string, string | string[]>;
export type DocFonts = { regular: ArrayBuffer; bold: ArrayBuffer };
export type DocBuilder = (values: DocValues, fonts: DocFonts) => Promise<Uint8Array>;
