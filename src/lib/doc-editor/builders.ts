// PDF builders by document id. Loaded lazily: pdf-lib arrives only when the editor opens.
import type { DocBuilder } from './spec';

export const builders: Record<string, () => Promise<DocBuilder>> = {
	prijava: async () => {
		const { buildPrijava } = await import('../prijava-pdf');
		return (values, fonts) => buildPrijava(values as never, fonts);
	},
};
