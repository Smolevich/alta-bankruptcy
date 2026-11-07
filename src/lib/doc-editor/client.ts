// Клиент DocEditor: модалка, живой предпросмотр (pdf.js) и скачивание. Предпросмотр и скачивание
// собираются одним сборщиком из одних данных — скачанный PDF совпадает с показанным.
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { builders } from './builders';
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

	// Старые страницы видны, пока новые не готовы: вместо белого листа — пометка «Обновляем…».
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
			// Встроенные браузеры (Telegram на iOS) не умеют download у blob: оставляем ссылку на открытие.
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

	// Форма живёт в DOM страницы и при закрытии не сбрасывается: введённое сохраняется до перезагрузки.
	const open = () => {
		if (!dlg.open) dlg.showModal();
		document.documentElement.style.overflow = 'hidden';
		render();
	};

	form.addEventListener('input', schedule);
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
