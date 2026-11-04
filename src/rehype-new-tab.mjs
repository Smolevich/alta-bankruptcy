// Плагин rehype: в тексте страниц внешние ссылки и ссылки на PDF открываются в новой вкладке,
// а PDF — в просмотре на сайте (data-pdf, см. PdfDialog.astro).
import { opensInNewTab } from './links.ts';
import { isPdf, viewerSrc } from './data/pdfs.ts';

function walk(node) {
	if (node.type === 'element' && node.tagName === 'a') {
		const href = node.properties?.href;
		if (typeof href === 'string' && opensInNewTab(href)) {
			node.properties.target = '_blank';
			node.properties.rel = ['noopener'];
			// Ссылка в тексте на Word-бланк AOD — это скачивание, просмотр PDF у неё отдельной ссылкой.
			const view = isPdf(href) ? viewerSrc(href) : null;
			if (view) node.properties.dataPdf = view;
		}
	}
	for (const child of node.children ?? []) walk(child);
}

export default function rehypeNewTab() {
	return (tree) => walk(tree);
}
