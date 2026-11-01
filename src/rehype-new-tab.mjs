// Плагин rehype: в тексте страниц внешние ссылки и ссылки на PDF открываются в новой вкладке.
import { opensInNewTab } from './links.ts';

function walk(node) {
	if (node.type === 'element' && node.tagName === 'a') {
		const href = node.properties?.href;
		if (typeof href === 'string' && opensInNewTab(href)) {
			node.properties.target = '_blank';
			node.properties.rel = ['noopener'];
		}
	}
	for (const child of node.children ?? []) walk(child);
}

export default function rehypeNewTab() {
	return (tree) => walk(tree);
}
