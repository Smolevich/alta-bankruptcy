// DocEditor client: modal, live preview (pdf.js) and download. Preview and download
// are built by one builder from the same data, so the downloaded PDF matches what is shown.
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { blockLists, builders } from './builders';
import { blockText, emptyEdits, hasEdits, parseEdits } from './blocks.mjs';
import { blocksEnter } from './enter.mjs';
import type { DocFonts, DocValues } from './spec';

type Pdfjs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjs: Promise<Pdfjs> | null = null;
const loadPdfjs = () =>
	(pdfjs ??= import('pdfjs-dist/legacy/build/pdf.mjs').then((m) => {
		m.GlobalWorkerOptions.workerSrc = workerSrc;
		return m;
	}));

const fetchBytes = (url: string) => fetch(url).then((r) => r.arrayBuffer());

function readValues(form: HTMLFormElement): DocValues {
	const values: DocValues = {};
	for (const el of form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name]')) {
		values[el.name] = el.dataset.type === 'lines' ? el.value.split('\n') : el.value;
	}
	return values;
}

async function renderPages(bytes: Uint8Array, width: number): Promise<HTMLCanvasElement[]> {
	const lib = await loadPdfjs();
	const doc = await lib.getDocument({ data: bytes, isEvalSupported: false }).promise;
	const ratio = Math.min(devicePixelRatio || 1, 2);
	const canvases: HTMLCanvasElement[] = [];
	try {
		for (let n = 1; n <= doc.numPages; n++) {
			const page = await doc.getPage(n);
			const base = page.getViewport({ scale: 1 });
			const vp = page.getViewport({ scale: (width / base.width) * ratio });
			const c = document.createElement('canvas');
			c.width = Math.floor(vp.width);
			c.height = Math.floor(vp.height);
			await page.render({ canvas: c, viewport: vp }).promise;
			canvases.push(c);
		}
	} finally {
		await doc.loadingTask.destroy();
	}
	return canvases;
}

function initEditor(root: HTMLElement) {
	const dlg = root.querySelector<HTMLDialogElement>('dialog')!;
	const form = root.querySelector<HTMLFormElement>('form')!;
	const body = root.querySelector<HTMLElement>('.de-body')!;
	const preview = root.querySelector<HTMLElement>('.de-preview')!;
	const pages = root.querySelector<HTMLElement>('.de-pages')!;
	const updating = root.querySelector<HTMLElement>('.de-updating')!;
	const status = root.querySelector<HTMLElement>('.de-status')!;
	const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
	const { builder: id, fileName, fontRegular, fontBold } = root.dataset;
	let fonts: Promise<DocFonts> | null = null;
	let lastUrl = '';
	let run = 0;
	let timer = 0;

	const build = async () => {
		fonts ??= Promise.all([fetchBytes(fontRegular!), fetchBytes(fontBold!)]).then(([regular, bold]) => ({ regular, bold }));
		const [fn, f] = await Promise.all([builders[id!](), fonts]);
		return fn(readValues(form), f);
	};

	// Old pages stay visible until the new ones are ready: an "Updating…" note instead of a white sheet.
	const render = async () => {
		const my = ++run;
		updating.hidden = false;
		preview.setAttribute('aria-busy', 'true');
		try {
			const bytes = await build();
			if (my !== run) return;
			const canvases = await renderPages(bytes, Math.max(pages.clientWidth, 600));
			if (my === run) pages.replaceChildren(...canvases);
		} catch (err) {
			if (my === run) status.textContent = `${status.dataset.failed} ${(err as Error).message}`;
		} finally {
			if (my === run) {
				updating.hidden = true;
				preview.setAttribute('aria-busy', 'false');
			}
		}
	};

	// "Document text": every template block can be edited, removed or restored, and the reader can add paragraphs.
	// The edits sit in the hidden _edits field (so the PDF builder sees them) and in localStorage; nothing goes to a server.
	let refreshBlocks = () => {};
	const blocksEl = root.querySelector<HTMLElement>('.de-blocks');
	if (blocksEl) {
		const L = JSON.parse(blocksEl.dataset.blocks!) as Record<string, string>;
		const listEl = blocksEl.querySelector<HTMLElement>('.de-blocks-list')!;
		const warnEl = blocksEl.querySelector<HTMLElement>('.de-blocks-warn')!;
		const hiddenEl = blocksEl.querySelector<HTMLInputElement>('input[name=_edits]')!;
		const storeKey = `de-edits:${id}`;
		let edits = emptyEdits();
		try {
			edits = parseEdits(localStorage.getItem(storeKey));
		} catch {
			// Storage is blocked (private window): the editor works, edits are just not kept.
		}
		const editing = new Set<string>();
		let template: ((v: ReturnType<typeof readValues>) => { id: string }[]) | null = null;

		const persist = () => {
			hiddenEl.value = hasEdits(edits) ? JSON.stringify(edits) : '';
			warnEl.hidden = !hasEdits(edits);
			try {
				localStorage.setItem(storeKey, hiddenEl.value);
			} catch {
				// see above
			}
		};
		const changed = () => {
			persist();
			draw();
			schedule();
		};
		const btn = (label: string, fn: () => void) => {
			const b = document.createElement('button');
			b.type = 'button';
			b.textContent = label;
			b.addEventListener('click', fn);
			return b;
		};
		const li = (...kids: HTMLElement[]) => {
			const n = document.createElement('li');
			n.append(...kids);
			return n;
		};
		const div = (cls: string, ...kids: (HTMLElement | string)[]) => {
			const n = document.createElement('div');
			n.className = cls;
			n.append(...kids);
			return n;
		};
		const area = (value: string, onInput: (v: string) => void, focus = false) => {
			const t = document.createElement('textarea');
			t.value = value;
			t.rows = Math.min(10, Math.max(3, value.split('\n').length + 1));
			t.placeholder = L.placeholder;
			t.addEventListener('input', () => {
				onInput(t.value);
				persist();
				schedule();
			});
			if (focus) queueMicrotask(() => t.focus());
			return t;
		};
		const addAfter = (after: string, at: number | null) => {
			const x = { id: `x${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, after, text: '' };
			edits.extra.splice(at ?? edits.extra.length, 0, x);
			editing.add(x.id);
			draw();
		};
		const extraItem = (x: (typeof edits.extra)[number]) =>
			li(
				area(x.text, (v) => (x.text = v), editing.delete(x.id)),
				div(
					'de-ba',
					btn(L.add, () => addAfter(x.after ?? '', edits.extra.indexOf(x) + 1)),
					btn(L.remove, () => {
						edits.extra = edits.extra.filter((e) => e !== x);
						changed();
					}),
				),
			);

		function draw() {
			const blocks = template ? (template(readValues(form)) as unknown as Parameters<typeof blockText>[0][]) : [];
			const ids = new Set(blocks.map((b: { id: string }) => b.id));
			const rows: HTMLElement[] = [];
			for (const b of blocks) {
				const bid = b.id;
				const removed = edits.removed.includes(bid);
				const isEdited = edits.edited[bid] !== undefined;
				const text = edits.edited[bid] ?? blockText(b);
				const row = li();
				if (removed) row.dataset.removed = '';
				const actions = div('de-ba');
				if (editing.has(bid) && !removed) {
					row.append(area(text, (v) => (v === blockText(b) ? delete edits.edited[bid] : (edits.edited[bid] = v)), true));
					actions.append(btn(L.done, () => (editing.delete(bid), draw())));
				} else {
					const shown = document.createElement('div');
					shown.className = 'de-bt';
					shown.textContent = text;
					row.append(shown);
					if (removed) actions.append(btn(L.restore, () => ((edits.removed = edits.removed.filter((r) => r !== bid)), changed())));
					else actions.append(btn(L.edit, () => (editing.add(bid), draw())));
				}
				if (isEdited && !removed) {
					actions.append(btn(L.reset, () => (delete edits.edited[bid], editing.delete(bid), changed())));
				}
				if (!removed) actions.append(btn(L.remove, () => (edits.removed.push(bid), editing.delete(bid), changed())));
				actions.append(btn(L.add, () => addAfter(bid, edits.extra.findIndex((x) => x.after === bid) < 0 ? null : edits.extra.findIndex((x) => x.after === bid))));
				if (isEdited || removed) row.append(div('de-bm', removed ? L.removed : L.edited));
				row.append(actions);
				rows.push(row, ...edits.extra.filter((x) => x.after === bid).map(extraItem));
			}
			rows.push(...edits.extra.filter((x) => !ids.has(x.after ?? '')).map(extraItem));
			listEl.replaceChildren(...rows);
		}

		refreshBlocks = async () => {
			template ??= (await blockLists[id!]()) as typeof template;
			draw();
		};
		persist();
	}

	const schedule = () => {
		updating.hidden = false;
		clearTimeout(timer);
		timer = window.setTimeout(render, 400);
	};

	const download = async () => {
		status.textContent = status.dataset.building!;
		try {
			const bytes = await build();
			if (lastUrl) URL.revokeObjectURL(lastUrl);
			lastUrl = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
			const a = document.createElement('a');
			a.href = lastUrl;
			a.download = fileName!;
			document.body.append(a);
			a.click();
			a.remove();
			// Embedded browsers (Telegram on iOS) cannot download a blob: keep the open link.
			const open = document.createElement('a');
			open.href = lastUrl;
			open.target = '_blank';
			open.textContent = status.dataset.open!;
			status.replaceChildren(`${status.dataset.done} `, open);
		} catch (err) {
			status.textContent = `${status.dataset.failed} ${(err as Error).message}`;
		}
	};

	const show = (tab: string) => {
		body.dataset.show = tab;
		tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
	};

	// The form lives in the page DOM and is not reset on close: typed input is kept until reload.
	const open = () => {
		if (!dlg.open) dlg.showModal();
		document.documentElement.style.overflow = 'hidden';
		refreshBlocks();
		render();
	};

	// Enter in a one-line field would submit the form and download the PDF mid-typing.
	form.addEventListener('keydown', (e) => blocksEnter(e) && e.preventDefault());
	form.addEventListener('input', (e) => {
		// Typing inside a block must not redraw the list under the cursor.
		if (!(e.target as Element).closest('.de-blocks')) refreshBlocks();
		schedule();
	});
	form.addEventListener('submit', (e) => {
		e.preventDefault();
		download();
	});
	tabs.forEach((b) => b.addEventListener('click', () => show(b.dataset.tab!)));
	root.querySelector('[data-open]')!.addEventListener('click', open);
	root.querySelector('[data-close]')!.addEventListener('click', () => dlg.close());
	dlg.addEventListener('close', () => {
		document.documentElement.style.overflow = '';
		if (location.hash === `#${root.id}`) history.replaceState(null, '', location.pathname + location.search);
	});

	const openOnHash = () => location.hash === `#${root.id}` && open();
	openOnHash();
	addEventListener('hashchange', openOnHash);
}

document.querySelectorAll<HTMLElement>('[data-doc-editor]').forEach(initEditor);
