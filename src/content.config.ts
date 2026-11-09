import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

// Правило сайта «нет источника — нет правки» зашито в схему: страница или новость
// без хотя бы одного источника не соберётся.
// official — только госорганы, суды, банки и регуляторы; правовые базы, издатели, палаты — reference;
// own — материалы самого сайта. Какой kind допустим для домена, проверяет scripts/check-sources.mjs.
export const SOURCE_KINDS = ['official', 'reliable_media', 'unverified', 'reference', 'own'] as const;

const source = z.object({
	title: z.string().min(1),
	url: z.string().url(),
	kind: z.enum(SOURCE_KINDS),
	date: z.coerce.date(),
	// Официальные сайты удаляют и переносят файлы: рядом с оригиналом — наша копия PDF
	// (/docs/…) или снимок страницы в веб-архиве.
	copy: z
		.string()
		.regex(/^(\/docs\/|https:\/\/web\.archive\.org\/web\/|https:\/\/archive\.ph\/)/, 'Копия: /docs/… или ссылка на веб-архив')
		.optional(),
});
// Строка на трёх языках: пропуск любого языка ломает сборку.
const loc = z.object({ ru: z.string(), en: z.string(), sr: z.string() });
const sources = z.array(source).min(1, 'Нужен хотя бы один источник');

export const collections = {
	// Для sr-Latn у Starlight нет своего перевода интерфейса: без src/content/i18n/sr-Latn.json
	// меню, поиск и подписи якорей на /sr/ падают в язык корня — русский.
	i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
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
			publisher: z.enum(['aod', 'nbs', 'bank', 'postanska', 'court', 'city']),
			summary: z.string().min(20).max(900),
			// Порядок среди новостей одного дня: больше — выше.
			order: z.number().default(0),
			// Бланки AOD, которые показать карточками под новостью (src/data/aod-forms.ts).
			forms: z.array(z.enum(['prijava', 'fizicka', 'pravna'])).optional(),
			// Новость устарела по более поздним официальным сообщениям: текст не трогаем, пометку показываем над ним.
			outdated: z
				.object({
					note: z.string().min(10),
					links: z.array(z.object({ label: z.string().min(1), href: z.string().startsWith('/') })).default([]),
				})
				.optional(),
			sources,
		}),
	}),
	status: defineCollection({
		loader: file('src/data/status.json'),
		schema: z.object({
			stage: z.number().int().min(1),
			// Дата выхода объявления в «Службени гласник» (YYYY-MM-DD); null, пока объявления нет.
			publicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
			headline: loc,
			note: loc,
			checkedAt: z.coerce.date(),
			stages: z
				.array(
					z.object({
						n: z.number().int(),
						// Идёт параллельно с текущей стадией: на шкале тоже «Мы здесь».
						parallel: z.boolean().optional(),
						title: loc,
						when: loc,
						// Ссылки рядом со сроком (текст объявления, страница выпуска); copy — копия в веб-архиве.
						links: z.array(z.object({ label: loc, url: z.string().url(), copy: z.string().url().optional() })).optional(),
						// Пройденная стадия: ссылка на источник; будущая: что её запускает.
						source: z.object({ url: z.string().url(), label: loc }).optional(),
						trigger: loc.optional(),
					}),
				)
				.min(2),
			sources,
		}),
	}),
};
