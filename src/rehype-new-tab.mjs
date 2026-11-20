// rehype plugin: in page text, external links and PDF links open in a new tab,
// and a PDF opens in the on-site viewer (data-pdf, see PdfDialog.astro).
import { opensInNewTab } from './links.ts';
import { isPdf, viewerSrc } from './data/pdfs.ts';

function walk(node) {
	if (node.type === 'element' && node.tagName === 'a') {
		const href = node.properties?.href;
		if (typeof href === 'string' && opensInNewTab(href)) {
			node.properties.target = '_blank';
			node.properties.rel = ['noopener'];
			// A text link to an AOD Word form is a download; its PDF viewer is a separate link.
			const view = isPdf(href) ? viewerSrc(href) : null;
			if (view) node.properties.dataPdf = view;
		}
	}
	for (const child of node.children ?? []) walk(child);
}

export default function rehypeNewTab() {
	return (tree) => walk(tree);
}
