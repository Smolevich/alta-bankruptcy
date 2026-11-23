// Builds the claim PDF from JSON on stdin and prints its text: a helper for prijava-pdf.test.mjs (runs with
// --experimental-transform-types because prijava-pdf.ts is TypeScript with constructor parameter properties).
import { readFileSync } from 'node:fs';
import { buildPrijava } from '../src/lib/prijava-pdf.ts';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const font = (n: string) => readFileSync(new URL(`../src/assets/fonts/${n}`, import.meta.url));
const buf = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) as ArrayBuffer;
const data = JSON.parse(readFileSync(0, 'utf8'));
const bytes = await buildPrijava(data, { regular: buf(font('LiberationSerif-Regular-sub.ttf')), bold: buf(font('LiberationSerif-Bold-sub.ttf')) });
const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
let text = '';
for (let n = 1; n <= doc.numPages; n++) {
	const c = await (await doc.getPage(n)).getTextContent();
	text += c.items.map((i: { str: string; hasEOL?: boolean }) => i.str + (i.hasEOL ? '\n' : '')).join('') + '\n';
}
process.stdout.write(text);
