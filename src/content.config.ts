import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

// Правило сайта «нет источника — нет правки» зашито в схему: страница или новость
// без хотя бы одного источника не соберётся.
export const SOURCE_KINDS = ['official', 'reliable_media', 'unverified'] as const;

const source = z.object({
	title: z.string().min(1),
	url: z.string().url(),
	kind: z.enum(SOURCE_KINDS),
	date: z.coerce.date(),
});
// Строка на трёх языках: пропуск любого языка ломает сборку.
const loc = z.object({ ru: z.string(), en: z.string(), sr: z.string() });
const sources = z.array(source).min(1, 'Нужен хотя бы один источник');

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				sources,
				// Когда автор последний раз сверял страницу с источниками.
				checked: z.coerce.date(),
			}),
		}),
	}),
	news: defineCollection({
		loader: glob({ pattern: '*/*.md', base: './src/content/news' }),
		schema: z.object({
			title: z.string().min(1),
			date: z.coerce.date(),
			publisher: z.enum(['aod', 'nbs', 'bank', 'court']),
			summary: z.string().min(20).max(900),
			// Порядок среди новостей одного дня: больше — выше.
			order: z.number().default(0),
			// Бланки AOD, которые показать карточками под новостью (src/data/aod-forms.ts).
			forms: z.array(z.enum(['prijava', 'fizicka', 'pravna'])).optional(),
			sources,
		}),
	}),
	status: defineCollection({
		loader: file('src/data/status.json'),
		schema: z.object({
			stage: z.number().int().min(1),
			headline: loc,
			note: loc,
			checkedAt: z.coerce.date(),
			stages: z.array(z.object({ n: z.number().int(), title: loc, when: loc })).min(2),
			sources,
		}),
	}),
};
