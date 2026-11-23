// Claim form of a natural person ("Пријава потраживања физичког лица"): the AOD sample text (potrazivanja.docx, 04.11.2026) word for word,
// with hints in parentheses replaced by values. The "phone / email" row is not from the sample: it is required by the
// AOD instruction of 10.11.2026 (uputstvo.pdf, p. 1, item 1), the 04.11 sample has no such field. The document is rebuilt rather than overlaid on a copy of the form:
// entered text of any length wraps across lines instead of hitting the underscores.
// The font is a Liberation Serif subset: Cyrillic and č ć š ž đ. The sign ˮ (U+02EE) from the original is not in it,
// so the closing quote is printed as ” of the same style.
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { asList, joinLines } from './doc-editor/join-lines.mjs';
import { applyEdits, parseEdits } from './doc-editor/blocks.mjs';

export type PrijavaData = {
	caseNo: string;
	name: string;
	address: string | string[];
	jmbg: string;
	passport: string;
	phone: string;
	email: string;
	account: string | string[];
	bank: string | string[];
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
	amount: string | string[];
	basis: string[];
	contracts: string | string[];
	funds: string | string[];
	received: string | string[];
	remaining: string | string[];
	rate: string;
	deliveryAddress: string;
	deliveryEmail: string;
	evidence: string[];
	// JSON of the reader's block edits (see doc-editor/blocks.mjs); absent in older saved data.
	_edits?: string;
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

// An empty field is printed as an underline: the form can be printed and filled in by hand.
const v = (s: string, blank = BLANK): Run => ({ t: s.trim() || blank, b: true });

// In the sample a period follows the date ("од ____ . године"): the Serbian date has its own, so we do not add a second.
const dated = (s: string, blank = `${BLANK}.`): Run => v(s.trim() && !s.trim().endsWith('.') ? `${s.trim()}.` : s, blank);

// A word with no spaces wider than the line (a long account number, a glued name) would otherwise overflow the field:
// split it by characters into chunks that each fit a line.
function splitLong(t: string, f: PDFFont, width: number): { t: string; f: PDFFont }[] {
	if (/^\s+$/.test(t) || f.widthOfTextAtSize(t, SIZE) <= width) return [{ t, f }];
	const parts: { t: string; f: PDFFont }[] = [];
	let cur = '';
	for (const ch of t) {
		if (cur && f.widthOfTextAtSize(cur + ch, SIZE) > width) {
			parts.push({ t: cur, f });
			cur = '';
		}
		cur += ch;
	}
	if (cur) parts.push({ t: cur, f });
	return parts;
}

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

	// Word wrapping that keeps the bold of values: each word is measured with its own font.
	para(runs: Run[], opts: { center?: boolean; indent?: number } = {}) {
		const width = PAGE[0] - 2 * MARGIN - (opts.indent ?? 0);
		const words: { t: string; f: PDFFont }[] = [];
		for (const r of runs) {
			const f = r.b ? this.fonts.bold : this.fonts.regular;
			for (const w of r.t.split(/(\s+)/)) if (w) words.push(...splitLong(w, f, width));
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

	// An empty list is printed as as many "*" lines as the sample has.
	bullets(items: string[], blankRows: number, plain = false) {
		const list = items.map((s) => s.trim()).filter(Boolean);
		for (const item of list.length ? list : Array(blankRows).fill('')) this.para([{ t: '* ' }, plain ? { t: item } : v(item)], { indent: 14 });
	}
}


export type Block = {
	id: string;
	runs?: Run[];
	list?: string[];
	blank?: number;
	plain?: boolean;
	bold?: boolean;
	center?: boolean;
	indent?: number;
	// Blank space before the block, in half-line steps: 1 = a full line, 0.5 = half.
	gap?: number;
};

const RANK =
	'признато потраживање разврста у први исплатни ред, у складу са чланом 20. став 1. тачка 1) Закона о стечају и ликвидацији банака и друштава за осигурање;';

// The template: structure of a claim actually filed and stamped by the court on 23.11.2026, with values substituted.
// A block whose source is empty is left out (contracts, funds, ...): the reader can add or restore it in the editor.
export function prijavaBlocks(d: PrijavaData): Block[] {
	const amounts = asList(d.amount);
	const contracts = asList(d.contracts);
	const funds = asList(d.funds);
	const received = asList(d.received);
	const remaining = asList(d.remaining);
	const rate = d.rate.trim();
	const proposeItems = [
		`утврди и призна потраживање у износу од ${joinLines(d.remaining, ' и ') || joinLines(d.amount, ' и ') || BLANK};`,
		RANK,
		...(d.deliveryAddress.trim() || d.deliveryEmail.trim()
			? [
					`сва писмена достављају Повериоцу на адресу ${d.deliveryAddress.trim() || BLANK}` +
						(d.deliveryEmail.trim() ? ` и на адресу електронске поште ${d.deliveryEmail.trim()}` : '') + '.',
				]
			: []),
	];
	const blocks: (Block | false)[] = [
		{ id: 'title1', runs: [{ t: 'ПРИЈАВА ПОТРАЖИВАЊА', b: true }], bold: true, center: true },
		{ id: 'title2', runs: [{ t: 'СТЕЧАЈНОГ ПОВЕРИОЦА', b: true }], bold: true, center: true },
		{ id: 'court', runs: [{ t: 'ПРИВРЕДНОМ СУДУ У БЕОГРАДУ', b: true }], bold: true, gap: 1 },
		{ id: 'courtAddr', runs: [{ t: 'Масарикова 2, 11000 Београд' }] },
		{ id: 'caseRef', runs: [{ t: 'Ст. ' }, v(d.caseNo, '_____ /_____')] },
		{ id: 'creditorHead', runs: [{ t: 'Стечајни поверилац:', b: true }], bold: true, gap: 1 },
		{ id: 'creditorKind', runs: [{ t: 'физичко лице', b: true }], bold: true },
		{
			id: 'creditor',
			runs: [
				v(d.name), { t: ' из ' }, v(joinLines(d.address, ', ')), { t: ' ЈМБГ: ' }, v(d.jmbg),
				...(d.passport.trim() ? [{ t: ', пасош: ' }, v(d.passport)] : []),
				{ t: ', рачун бр. ' }, v(joinLines(d.account, ' и ')), { t: ' у ' }, v(joinLines(d.bank, ' и ')), { t: ' банци а. д. ' }, v(d.bankSeat),
			],
		},
		{ id: 'contact', runs: [{ t: 'телефон: ' }, v(d.phone), { t: ' мејл: ' }, v(d.email)] },
		{ id: 'debtorHead', runs: [{ t: 'Стечајни дужник:', b: true }], bold: true, gap: 0.5 },
		{
			id: 'debtor',
			runs: [
				v(d.debtor), { t: ' из ' }, v(d.debtorSeat), { t: ', ког заступа ' }, v(d.debtorRep),
				{ t: ', матични број: ' }, v(d.debtorMb), { t: ', ПИБ ' }, v(d.debtorPib),
			],
		},
		{ id: 'claimTitle', runs: [{ t: 'Пријава потраживања у поступку стечаја над ', b: true }, v(d.debtor)], bold: true, center: true, gap: 1 },
		{
			id: 'opened',
			gap: 0.5,
			runs: [
				{ t: 'Привредни суд у ' }, v('Београду'),
				{ t: ' отворио је стечајни поступак над Стечајним дужником Решењем посл. бр. Ст. ' }, v(d.caseNo), { t: ' од ' }, dated(d.decisionDate),
				{ t: ' године, а оглас о отварању стечајног поступка објављен је у „Службеном гласнику Републике Србије” бр. ' },
				v(d.gazetteNo, '_____'), { t: ' од ' }, dated(d.gazetteDate), { t: ' године.' },
			],
		},
		{
			id: 'deadline',
			gap: 0.5,
			runs: [
				{ t: 'Огласом су позвани повериоци да пријаве своја потраживања Привредном суду у Београду у року од ' },
				v(d.days, '_____'), { t: ' дана рачунајући од дана објављивања огласа.' },
			],
		},
		{ id: 'claimLead', gap: 0.5, runs: [{ t: 'Поверилац благовремено пријављује потраживања према Стечајном дужнику у следећим износима:' }] },
		{ id: 'amounts', list: amounts, blank: 2 },
		{ id: 'basisLead', gap: 0.5, runs: [{ t: 'Наведена потраживања заснивају се на чињеницама, обрачунима и доказима наведеним у наставку.' }] },
		d.basis.some((s) => s.trim()) && { id: 'basis', list: asList(d.basis) },
		contracts.length > 0 && { id: 'contractsLead', gap: 0.5, runs: [{ t: 'Поверилац је са Банком закључио следеће уговоре:' }] },
		contracts.length > 0 && { id: 'contracts', list: contracts },
		funds.length > 0 && { id: 'fundsLead', gap: 0.5, runs: [{ t: 'На дан отварања стечајног поступка код Банке су се налазила следећа новчана средства Повериоца:' }] },
		funds.length > 0 && { id: 'funds', list: funds },
		received.length > 0 && {
			id: 'received',
			gap: 0.5,
			runs: [
				{ t: 'Наведени износи утврђени су у поступку исплате осигураних депозита („Преглед података о депозитима и нереализованим чековима”). Поверилац је на име осигураних депозита примио: ' },
				v(received.join(' и ')), { t: '.' },
			],
		},
		remaining.length > 0 && {
			id: 'remaining',
			gap: 0.5,
			runs: [
				{ t: 'Након исплате, остатак потраживања износи ' }, v(remaining.join(' и ')),
				...(rate ? [{ t: `, по званичном средњем курсу НБС на дан отварања стечајног поступка (${rate} RSD за 1 EUR).` }] : [{ t: '.' }]),
			],
		},
		{ id: 'proposeLead', gap: 0.5, runs: [{ t: 'На основу свега наведеног и приложених доказа, Поверилац предлаже да се:' }] },
		{ id: 'propose', list: proposeItems, plain: true },
		{ id: 'evidenceLead', gap: 0.5, runs: [{ t: 'Докази који се прилажу уз пријаву (копије):' }] },
		{ id: 'evidence', list: asList(d.evidence), blank: 4 },
		{ id: 'place', gap: 1.5, runs: [{ t: 'У ' }, v(d.place), { t: ' дана ' }, dated(d.date, BLANK), { t: ' године' }] },
		{ id: 'sigLine', gap: 2, runs: [{ t: '__________________' }] },
		{ id: 'sigName', runs: [{ t: 'Стечајни поверилац' }] },
	];
	return blocks.filter((b): b is Block => !!b);
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

	for (const b of applyEdits(prijavaBlocks(d), parseEdits(d._edits)) as Block[]) {
		if (b.gap) w.gap(LEAD * b.gap);
		if (b.list) w.bullets(b.list, b.blank ?? 0, b.plain);
		else w.para(b.runs!, { center: b.center, indent: b.indent });
	}
	return doc.save();
}
