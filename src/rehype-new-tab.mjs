// Плагин rehype: в тексте страниц внешние ссылки и ссылки на PDF открываются в новой вкладке,
// а PDF — в просмотре на сайте (data-pdf, см. PdfDialog.astro).
import { opensInNewTab } from './links.ts';
import { viewerSrc } from './data/pdfs.ts';

function walk(node) {
	if (node.type === 'element' && node.tagName === 'a') {
		const href = node.properties?.href;
		if (typeof href === 'string' && opensInNewTab(href)) {
			node.properties.target = '_blank';
			node.properties.rel = ['noopener'];
			const view = viewerSrc(href);
			if (view) node.properties.dataPdf = view;
		}
	}
	for (const child of node.children ?? []) walk(child);
}

export default function rehypeNewTab() {
	return (tree) => walk(tree);
}
