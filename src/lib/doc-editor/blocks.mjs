// Editable blocks of a document. The template yields blocks ({ id, runs } for a paragraph or { id, list } for bullets);
// the reader's edits live apart from it: { edited: id -> text, removed: [id], extra: [{ id, after, text }] }.
// Applying them is a pure function, so the PDF and the editor's preview agree and a reset is just dropping the key.

export const emptyEdits = () => ({ edited: {}, removed: [], extra: [] });

export const blockText = (b) => (b.list ? b.list.join('\n') : b.runs.map((r) => r.t).join(''));

const isStr = (x) => typeof x === 'string';

// Saved data may be old, empty or hand-broken: whatever is not recognised is dropped, never thrown.
export function parseEdits(raw) {
	const out = emptyEdits();
	let data;
	try {
		data = typeof raw === 'string' ? JSON.parse(raw) : raw;
	} catch {
		return out;
	}
	if (!data || typeof data !== 'object') return out;
	if (data.edited && typeof data.edited === 'object') {
		for (const [k, v] of Object.entries(data.edited)) if (isStr(v)) out.edited[k] = v;
	}
	if (Array.isArray(data.removed)) out.removed = data.removed.filter(isStr);
	if (Array.isArray(data.extra)) {
		out.extra = data.extra.filter((x) => x && isStr(x.id) && isStr(x.text)).map((x) => ({ id: x.id, after: isStr(x.after) ? x.after : null, text: x.text }));
	}
	return out;
}

export const hasEdits = (e) => Object.keys(e.edited).length > 0 || e.removed.length > 0 || e.extra.some((x) => x.text.trim());

function paragraphs(b, text) {
	const out = [];
	let gap = b.gap;
	let pending = 0;
	for (const line of text.split('\n')) {
		if (!line.trim()) {
			pending = 0.5;
			continue;
		}
		out.push({ id: b.id, runs: [{ t: line.trim(), b: b.bold }], center: b.center, indent: b.indent, bold: b.bold, gap: out.length ? pending : gap });
		pending = 0;
	}
	return out;
}

export function applyEdits(blocks, edits) {
	const extras = (after) =>
		edits.extra.filter((x) => x.after === after && x.text.trim()).flatMap((x) => paragraphs({ id: x.id, gap: 0.5 }, x.text));
	const out = [];
	for (const b of blocks) {
		if (!edits.removed.includes(b.id)) {
			const text = edits.edited[b.id];
			if (text === undefined) out.push(b);
			else if (b.list) out.push({ id: b.id, list: text.split('\n').map((s) => s.trim()).filter(Boolean), blank: 0, plain: true, gap: b.gap });
			else out.push(...paragraphs(b, text));
		}
		out.push(...extras(b.id));
	}
	const orphans = new Set(edits.extra.filter((x) => !blocks.some((b) => b.id === x.after)).map((x) => x.after));
	for (const after of orphans) out.push(...extras(after));
	return out;
}
