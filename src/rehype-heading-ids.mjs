// Плагин rehype: ставит заголовкам h2–h6 id из src/heading-ids.mjs вместо слагов из текста.
// Слаг из текста на ru/sr даёт кириллицу и %D0%… в ссылке, и на трёх языках якоря разные.
import { HEADING_IDS } from './heading-ids.mjs';

const HEADING = new Set(['h2', 'h3', 'h4', 'h5', 'h6']);

export function pageKey(path) {
	const m = /content\/docs\/(?:(?:en|sr)\/)?(.+)\.mdx?$/.exec(path ?? '');
	return m ? m[1] : null;
}

function headings(node, out = []) {
	if (node.type === 'element' && HEADING.has(node.tagName)) out.push(node);
	for (const child of node.children ?? []) headings(child, out);
	return out;
}

export default function rehypeHeadingIds() {
	return (tree, file) => {
		const key = pageKey(file.path);
		if (!key) return;
		const found = headings(tree);
		const ids = HEADING_IDS[key] ?? [];
		if (found.length !== ids.length) {
			throw new Error(`${file.path}: заголовков ${found.length}, а id в src/heading-ids.mjs — ${ids.length}`);
		}
		found.forEach((h, i) => { h.properties = { ...h.properties, id: ids[i] }; });
	};
}
