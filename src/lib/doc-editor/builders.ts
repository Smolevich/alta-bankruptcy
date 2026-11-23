// PDF builders by document id. Loaded lazily: pdf-lib arrives only when the editor opens.
import type { DocBuilder, DocValues } from './spec';
import type { Block } from '../prijava-pdf';

export const builders: Record<string, () => Promise<DocBuilder>> = {
	prijava: async () => {
		const { buildPrijava } = await import('../prijava-pdf');
		return (values, fonts) => buildPrijava(values as never, fonts);
	},
};

// Template blocks for the "Document text" section of the editor: the same list the builder prints from.
export const blockLists: Record<string, () => Promise<(values: DocValues) => Block[]>> = {
	prijava: async () => {
		const { prijavaBlocks } = await import('../prijava-pdf');
		return (values) => prijavaBlocks(values as never);
	},
};
