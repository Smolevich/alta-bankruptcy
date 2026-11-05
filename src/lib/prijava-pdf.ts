// Пријава потраживања физичког лица: текст образца AOD (potrazivanja.docx, 04.11.2026) слово в слово,
// подсказки в скобках заменены значениями. Документ собирается заново, а не накладывается на копию бланка:
// введённый текст любой длины переносится по строкам, а не упирается в подчёркивания.
// Шрифт — подмножество Liberation Serif: кириллица и č ć š ž đ. Знака ˮ (U+02EE) из оригинала в нём нет,
// закрывающая кавычка печатается ” того же начертания.
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type PrijavaData = {
	caseNo: string;
	name: string;
	address: string;
	jmbg: string;
	account: string;
	bank: string;
	bankSeat: string;
	debtor: string;
	debtorSeat: string;
	debtorRep: string;
	debtorMb: string;
	debtorPib: string;
	decisionDate: string;
	gazetteNo: string;
	gazetteDate: string;
	days: string;
	amount: string;
	basis: string[];
	evidence: string[];
	place: string;
	date: string;
};

type Run = { t: string; b?: boolean };
type Fonts = { regular: PDFFont; bold: PDFFont };

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 70;
const SIZE = 11.5;
const LEAD = SIZE * 1.45;
const BLANK = '______________';

// Пустое поле печатается подчёркиванием: бланк можно распечатать и дописать от руки.
const v = (s: string, blank = BLANK): Run => ({ t: s.trim() || blank, b: true });

// В образце после даты стоит точка («од ____ . године»): у сербской даты она своя, вторую не добавляем.
const dated = (s: string, blank = `${BLANK}.`): Run => v(s.trim() && !s.trim().endsWith('.') ? `${s.trim()}.` : s, blank);

class Writer {
	page!: PDFPage;
	y = 0;
	constructor(
		private doc: PDFDocument,
		private fonts: Fonts,
	) {
		this.newPage();
	}

	private newPage() {
		this.page = this.doc.addPage(PAGE);
		this.y = PAGE[1] - MARGIN;
	}

	private need(h: number) {
		if (this.y - h < MARGIN) this.newPage();
	}

	gap(h = LEAD) {
		this.y -= h;
	}

	// Перенос по словам с сохранением жирного у значений: каждое слово меряется своим шрифтом.
	para(runs: Run[], opts: { center?: boolean; indent?: number } = {}) {
		const width = PAGE[0] - 2 * MARGIN - (opts.indent ?? 0);
		const words: { t: string; f: PDFFont }[] = [];
		for (const r of runs) {
			const f = r.b ? this.fonts.bold : this.fonts.regular;
			for (const w of r.t.split(/(\s+)/)) if (w) words.push({ t: w, f });
		}
		const lines: { t: string; f: PDFFont }[][] = [[]];
		let cur = 0;
		for (const w of words) {
			const ww = w.f.widthOfTextAtSize(w.t, SIZE);
			const space = /^\s+$/.test(w.t);
			if (!space && cur + ww > width && lines[lines.length - 1].length) {
				lines.push([]);
				cur = 0;
			}
			if (space && cur === 0) continue;
			lines[lines.length - 1].push(w);
			cur += ww;
		}
		for (const line of lines) {
			while (line.length && /^\s+$/.test(line[line.length - 1].t)) line.pop();
			this.need(LEAD);
			const lw = line.reduce((s, w) => s + w.f.widthOfTextAtSize(w.t, SIZE), 0);
			let x = MARGIN + (opts.indent ?? 0) + (opts.center ? (width - lw) / 2 : 0);
			for (const w of line) {
				const t = w.t.replace(/\s+/g, ' ');
				this.page.drawText(t, { x, y: this.y - SIZE, size: SIZE, font: w.f, color: rgb(0, 0, 0) });
				x += w.f.widthOfTextAtSize(t, SIZE);
			}
			this.y -= LEAD;
		}
	}

	// Пустой список печатается столькими же строками «*», сколько их в образце.
	bullets(items: string[], blankRows: number) {
		const list = items.map((s) => s.trim()).filter(Boolean);
		for (const item of list.length ? list : Array(blankRows).fill('')) this.para([{ t: '* ' }, v(item)], { indent: 14 });
	}
}

export async function buildPrijava(d: PrijavaData, fontBytes: { regular: ArrayBuffer; bold: ArrayBuffer }) {
	const doc = await PDFDocument.create();
	doc.registerFontkit(fontkit);
	const fonts = {
		regular: await doc.embedFont(fontBytes.regular, { subset: true }),
		bold: await doc.embedFont(fontBytes.bold, { subset: true }),
	};
	doc.setTitle('Пријава потраживања стечајног повериоца');
	doc.setLanguage('sr-Cyrl');
	const w = new Writer(doc, fonts);

	w.para([{ t: 'ПРИЈАВА ПОТРАЖИВАЊА', b: true }], { center: true });
	w.para([{ t: 'СТЕЧАЈНОГ ПОВЕРИОЦА', b: true }], { center: true });
	w.gap();
	w.para([{ t: 'ПРИВРЕДНОМ СУДУ У БЕОГРАДУ', b: true }]);
	w.para([{ t: 'Ст. ' }, v(d.caseNo, '_____ /_____')]);
	w.gap();
	w.para([{ t: 'Стечајни поверилац:', b: true }]);
	w.para([{ t: 'физичко лице', b: true }]);
	w.para([
		v(d.name), { t: ' из ' }, v(d.address), { t: ' ЈМБГ: ' }, v(d.jmbg), { t: ' рачун бр. ' }, v(d.account),
		{ t: ' у ' }, v(d.bank), { t: ' банци а. д. ' }, v(d.bankSeat),
	]);
	w.gap(LEAD / 2);
	w.para([{ t: 'Стечајни дужник:', b: true }]);
	w.para([
		v(d.debtor), { t: ' из ' }, v(d.debtorSeat), { t: ', ког заступа ' }, v(d.debtorRep),
		{ t: ', матични број: ' }, v(d.debtorMb), { t: ', ПИБ ' }, v(d.debtorPib),
	]);
	w.gap();
	w.para([{ t: 'Пријава потраживања Стечајног повериоца', b: true }], { center: true });
	w.gap(LEAD / 2);
	w.para([
		{ t: 'Привредни суд у ' }, v('Београду'),
		{ t: ' отворио је стечајни поступак над Стечајним дужником Решењем Ст. ' }, v(d.caseNo), { t: ' од ' },
		dated(d.decisionDate),
		{ t: ' године, а оглас о отварању стечајног поступка објављен је у „Службеном гласнику Републике Србије” бр. ' },
		v(d.gazetteNo, '_____'), { t: ' од ' }, dated(d.gazetteDate), { t: ' године.' },
	]);
	w.gap(LEAD / 2);
	w.para([
		{ t: 'Огласом су позвани повериоци да пријаве своја потраживања Привредном суду у Београду у року од ' },
		v(d.days, '_____'), { t: ' дана рачунајући од дана објављивања огласа.' },
	]);
	w.gap(LEAD / 2);
	w.para([
		{ t: 'Поверилац благовремено пријављује потраживање према стечајном дужнику у укупном износу од ' },
		v(d.amount),
		{ t: ', са стањем на дан отварања стечајног поступка, и то на основу чињеница, обрачуна и доказа наведених у наставку и то по основу:' },
	]);
	w.bullets(d.basis, 3);
	w.gap(LEAD / 2);
	w.para([{ t: 'Докази који се прилажу уз пријаву:' }]);
	w.bullets(d.evidence, 4);
	w.gap(LEAD / 2);
	w.para([{ t: 'Поверилац подноси пријаву потраживања у укупном износу дуга од ' }, v(d.amount), { t: ', са предлогом да се' }]);
	w.gap(LEAD / 2);
	w.para([{ t: 'У Т В Р Д И', b: true }], { center: true });
	w.para([{ t: 'П О Т Р А Ж И В А Њ Е', b: true }], { center: true });
	w.gap(LEAD / 2);
	// «матични број» у физлица — это ЈМБГ (јединствени матични број грађана); «(ПИБ …)» в образце общий
	// для всех кредиторов, у физлица его нет, и строка остаётся чертой, как в бланке.
	w.para([
		{ t: 'Стечајном повериоцу ' }, v(d.name), { t: ' из ' }, v(d.address), { t: ' матични број ' }, v(d.jmbg),
		{ t: ', (ПИБ ' }, v(''), { t: ') рачун број ' }, v(d.account), { t: ' у ' }, v(d.bank), { t: ' банци' },
	]);
	w.para([{ t: 'потраживање у укупном износу од ' }, v(d.amount)]);
	w.gap(LEAD * 1.5);
	w.para([{ t: 'У ' }, v(d.place), { t: ' дана ' }, dated(d.date, BLANK), { t: ' године' }]);
	w.gap(LEAD * 2);
	w.para([{ t: '__________________' }]);
	w.para([{ t: 'Стечајни поверилац' }]);
	return doc.save();
}
