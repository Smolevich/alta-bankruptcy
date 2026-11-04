// Каждый PDF-источник открывается в просмотре на сайте (PdfDialog), рядом ссылка на оригинал.
// CSP сайта (backend, site.py) пускает во встроенный просмотр только свой домен,
// поэтому PDF с других сайтов показываем из своей копии: мелкие лежат в public/docs,
// документы AOD — в архиве бэкенда (/docs/aod/<name>). Список один на сайт и сервер.
import AOD_ARCHIVE from '../../backend/src/alta_feedback/data/aod_archive.json';
import { AOD_FORMS } from './aod-forms';
import { DOCS } from './documents';

/** Копия PDF с сайта AOD (запись backend/src/alta_feedback/data/aod_archive.json). */
export type ArchivedPdf = {
	name: string;
	url: string;
	/** false — в документе имена частных лиц: копия только в закрытом архиве, на сайте внешняя ссылка. */
	public: boolean;
	sha256: string;
	bytes: number;
	fetched: string;
};

const ARCHIVE = AOD_ARCHIVE as ArchivedPdf[];

const EXTRA_COPIES: Record<string, string> = {
	'https://www.nbs.rs/export/sites/NBS_site/documents/propisi/zakoni/kpb_banke_preuzimanje.pdf':
		'nbs-2012-zakon-preuzimanje-banaka.pdf',
	'https://web.archive.org/web/20161116045606/http://aod.rs/pdf/godisnji_finansijski_izvestaj_za_2013.pdf':
		'aod-2013-godisnji-finansijski-izvestaj.pdf',
	'https://web.archive.org/web/20160831012046/http://aod.rs/pdf/2014-02-06-uputstvo-za-podnosenje-prijave-potrazivanja.pdf':
		'aod-2014-02-06-uputstvo-prijava-potrazivanja.pdf',
	'http://www.bg.pr.sud.rs/docs/dokument_03112026_104425437.pdf':
		'privredni-sud-2026-11-03-resenje-10-st-275-2026.pdf',
	'https://web.archive.org/web/20160830213118/http://aod.rs/pdf/2014-02-06-obavestenje-o-nacinu-izmirivanja.pdf':
		'aod-2014-02-06-obavestenje-izmirivanje-obaveza.pdf',
};

// AOD выложил бланки только в Word: в просмотре показываем нашу PDF-копию,
// а ссылка «Оригинал» в просмотре ведёт на Word-файл AOD.
const WORD_AS_PDF: Record<string, string> = Object.fromEntries(
	Object.values(AOD_FORMS).map((f) => [f.sourceUrl, `/docs/${f.file}.pdf`]),
);

const LOCAL_COPY: Record<string, string> = {
	...Object.fromEntries(DOCS.map((d) => [d.sourceUrl, `/docs/${d.file}`])),
	...Object.fromEntries(Object.entries(EXTRA_COPIES).map(([url, file]) => [url, `/docs/${file}`])),
	...Object.fromEntries(ARCHIVE.filter((a) => a.public).map((a) => [a.url, `/docs/aod/${a.name}`])),
};

/** В документе имена частных лиц: копию не показываем, остаётся только внешняя ссылка. */
export const NO_COPY = new Set(ARCHIVE.filter((a) => !a.public).map((a) => a.url));

export const isPdf = (url: string) => /\.pdf($|[?#])/i.test(url);

/** Адрес для просмотра на сайте; null — не PDF или документ из NO_COPY. Неизвестный PDF валит сборку. */
export function viewerSrc(url: string): string | null {
	const [base, hash] = url.split('#');
	if (WORD_AS_PDF[base]) return WORD_AS_PDF[base];
	if (!isPdf(url)) return null;
	const tail = hash ? `#${hash}` : '';
	if (LOCAL_COPY[base]) return `${LOCAL_COPY[base]}${tail}`;
	if (base.startsWith('/docs/')) return url;
	if (NO_COPY.has(base)) return null;
	throw new Error(
		`PDF ${url} cannot be shown on the site: put a copy in public/docs (or the AOD archive in alta-feedback) ` +
			'and map it in src/data/pdfs.ts, or mark it non-public if it contains names of private persons.',
	);
}
