// Сборщики PDF по id документа. Грузятся лениво: pdf-lib приезжает только при открытии редактора.
import type { DocBuilder } from './spec';

export const builders: Record<string, () => Promise<DocBuilder>> = {
	prijava: async () => {
		const { buildPrijava } = await import('../prijava-pdf');
		return (values, fonts) => buildPrijava(values as never, fonts);
	},
};
