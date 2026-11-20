// rehype plugin: with a regular space the browser wraps "50 %" and "бланк .docx", and a line
// starts with the "%" sign or with ".docx". Such spaces are made non-breaking; code and
// markdown source quotes are left alone.
const NBSP = '\u00a0';
const SKIP = new Set(['code', 'pre', 'script', 'style']);
const DIGIT_SPACE_PERCENT = /(\d)[ \t]+%/g;
const WORD_SPACE_FILE_EXT = /(\S)[ \t]+(\.(?:docx?|pdf|xlsx?|eml))(?![\p{L}\p{N}])/giu;

export function bindPercent(text) {
	return text.replace(DIGIT_SPACE_PERCENT, `$1${NBSP}%`);
}

export function bindFileExt(text) {
	return text.replace(WORD_SPACE_FILE_EXT, `$1${NBSP}$2`);
}

function walk(node) {
	if (node.type === 'text') {
		node.value = bindFileExt(bindPercent(node.value));
		return;
	}
	if (node.type === 'element' && SKIP.has(node.tagName)) return;
	for (const child of node.children ?? []) walk(child);
}

export default function rehypeNbspPercent() {
	return (tree) => walk(tree);
}
