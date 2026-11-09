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
	'http://www.bg.pr.sud.rs/files/files/Saopstenje(1).pdf':
		'privredni-sud-2026-11-06-saopstenje-alta.pdf',
	'https://www.tok.jt.rs/html_tok/saopstenja/saopstenje_20261031_cir.pdf':
		'tok-2026-10-31-saopstenje.pdf',
	'https://www.tok.jt.rs/html_tok/saopstenja/saopstenje_20261102_1_cir.pdf':
		'tok-2026-11-02-saopstenje.pdf',
	'https://www.aod.rs/uploads/dokumenti/kvartalniizvestaj/Univerzal%20banka_1%20kvartal%202026.pdf':
		'aod-univerzal-2026-q1-kvartalni-izvestaj.pdf',
	'https://web.archive.org/web/20160830213118/http://aod.rs/pdf/2014-02-06-obavestenje-o-nacinu-izmirivanja.pdf':
		'aod-2014-02-06-obavestenje-izmirivanje-obaveza.pdf',
	'https://nbs.rs/export/sites/NBS_site/documents/propisi/zakoni/zastita_korisnika_finansijskih_usluga_2025.pdf':
		'nbs-2025-zakon-zastita-korisnika-finansijskih-usluga.pdf',
	'https://www.aod.rs/uploads/dokumenti/altabanka/uputstvo_novi_ra%C4%8Dun_6_11_2026.pdf':
		'aod-2026-11-06-uputstvo-izmirenje-obaveza-krediti.pdf',
	'https://www.aod.rs/uploads/dokumenti/altabanka/Obave%C5%A1tenje_o_po%C4%8Detku_isplate_OD_6nov2026.pdf':
		'aod-2026-11-06-obavestenje-pocetak-isplate.pdf',
	'https://www.aod.rs/uploads/dokumenti/altabanka/Spisak.pdf':
		'aod-2026-11-06-spisak-ekspozitura-postanska.pdf',
	'https://www.aod.rs/uploads/dokumenti/altabanka/FZI_20261106.pdf':
		'aod-2026-11-06-poziv-mali-investitori-fzi.pdf',
	'https://www.aod.rs/uploads/dokumenti/oglas/243_1_oglas.pdf':
		'aod-2026-11-09-javni-konkurs-poverenik.pdf',
	'https://www.aod.rs/uploads/dokumenti/pravnareg/40_pravnareg.pdf':
		'aod-zahtev-isplata-zasticenog-potrazivanja.pdf',
	'https://www.javnidug.gov.rs/static/uploads/Lista%20ovlascenih%20ucesnika_cir.pdf':
		'uprava-za-javni-dug-2025-05-lista-ovlascenih-ucesnika.pdf',
	'https://www.posted.co.rs/korisno/doc/Tarifa/Tarifa-naknada-za-usluge-u-radu-sa-fizickim-licima.pdf':
		'postanska-2026-tarifa-fizicka-lica.pdf',
	'https://www.posted.co.rs/korisno/doc/PUN/PUN_Devizni_tekuci_racuni.pdf':
		'postanska-2025-pregled-naknada-devizni-tekuci-racun-rezidenta.pdf',
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
