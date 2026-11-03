// Каждый PDF-источник открывается в просмотре на сайте (PdfDialog), рядом ссылка на оригинал.
// CSP сайта (alta-feedback, site.py) пускает во встроенный просмотр только свой домен и www.aod.rs,
// поэтому PDF с других сайтов показываем из копии в public/docs.
import { DOCS } from './documents';

const EMBED_ORIGINS = ['https://www.aod.rs/'];

const EXTRA_COPIES: Record<string, string> = {
	'https://www.nbs.rs/export/sites/NBS_site/documents/propisi/zakoni/kpb_banke_preuzimanje.pdf':
		'nbs-2012-zakon-preuzimanje-banaka.pdf',
	'https://web.archive.org/web/20161116045606/http://aod.rs/pdf/godisnji_finansijski_izvestaj_za_2013.pdf':
		'aod-2013-godisnji-finansijski-izvestaj.pdf',
};

const LOCAL_COPY: Record<string, string> = {
	...Object.fromEntries(DOCS.map((d) => [d.sourceUrl, d.file])),
	...EXTRA_COPIES,
};

/** В документе имена частных лиц: копию не храним, остаётся только внешняя ссылка. */
export const NO_COPY = new Set([
	'https://web.archive.org/web/20160830214352/http://aod.rs/pdf/2014-02-10-sluzbeni-glasnik-univerzal-banka.pdf',
]);

export const isPdf = (url: string) => /\.pdf($|[?#])/i.test(url);

/** Адрес для просмотра на сайте; null — не PDF или документ из NO_COPY. Неизвестный PDF валит сборку. */
export function viewerSrc(url: string): string | null {
	if (!isPdf(url)) return null;
	const [base, hash] = url.split('#');
	const tail = hash ? `#${hash}` : '';
	if (LOCAL_COPY[base]) return `/docs/${LOCAL_COPY[base]}${tail}`;
	if (base.startsWith('/docs/') || EMBED_ORIGINS.some((o) => base.startsWith(o))) return url;
	if (NO_COPY.has(base)) return null;
	throw new Error(
		`PDF ${url} cannot be shown on the site: put a copy in public/docs and map it in src/data/pdfs.ts, ` +
			'or add it to NO_COPY if it contains names of private persons.',
	);
}
